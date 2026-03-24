// Lambda function to get POAMs
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    const { systemId, status, limit = 100 } = event.queryStringParameters || {};
    const user = event.requestContext.authorizer.claims;

    let command;

    if (systemId) {
      // Query by systemId
      command = new QueryCommand({
        TableName: process.env.DYNAMODB_TABLE_POAMS,
        IndexName: 'systemId-index',
        KeyConditionExpression: 'systemId = :systemId',
        ExpressionAttributeValues: {
          ':systemId': systemId
        },
        Limit: parseInt(limit)
      });
    } else {
      // Scan all (with filters if provided)
      const filterExpressions = [];
      const expressionAttributeValues = {};

      if (status) {
        filterExpressions.push('status = :status');
        expressionAttributeValues[':status'] = status;
      }

      command = new ScanCommand({
        TableName: process.env.DYNAMODB_TABLE_POAMS,
        FilterExpression: filterExpressions.length > 0 ? filterExpressions.join(' AND ') : undefined,
        ExpressionAttributeValues: Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined,
        Limit: parseInt(limit)
      });
    }

    const result = await docClient.send(command);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        poams: result.Items || [],
        count: result.Count
      })
    };
  } catch (error) {
    console.error('Get POAMs error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
