// POAM Workbook (isolated module)

window.POAM_WORKBOOK_COLUMNS = [
  'Item number',
  'Vulnerability Name',
  'Vulnerability Description',
  'Detection Date',
  'Impacted Security Controls',
  'Office/Org',
  'POC Name',
  'Identifying Detecting Source',
  'Mitigations',
  'Severity Value',
  'Resources Required',
  'Scheduled Completion Date',
  'Milestone with Completion Dates',
  'Milestone Changes',
  'Affected Components/URLs',
  'Status',
  'Comments'
];

window.POAM_WORKBOOK_ENUMS = {
  detectingSources: ['Continuous Monitoring', 'Assessment', 'HVA Assessment', 'Pen Test'],
  severityValues: ['Critical', 'High', 'Medium', 'Low'],
  statusValues: ['Open', 'In Progress', 'Completed', 'Risk Accepted', 'Extended', 'Closed']
};

window.POAM_WORKBOOK_INTERNAL_FIELDS = {
  assetsImpacted: 'Assets Impacted'
};
