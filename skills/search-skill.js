/**
 * Search Skill
 *
 * Filters POAM records by free-text query.
 * Used by the vulnerability table for typeahead and explicit search execution.
 */
class SearchSkill extends BaseSkill {
    constructor(config = {}) {
        super('SearchSkill', config);
    }

    async run(input) {
        const { query = '', poams = [] } = input || {};
        const normalizedQuery = String(query).trim().toLowerCase();

        if (!normalizedQuery) {
            return {
                query: '',
                count: poams.length,
                results: poams
            };
        }

        const results = poams.filter(poam => {
            const searchable = [
                poam.id,
                poam.title,
                poam.vulnerability,
                poam.vulnerabilityName,
                poam.description,
                poam.findingDescription,
                poam.asset,
                Array.isArray(poam.affectedAssets) ? poam.affectedAssets.join(' ') : '',
                poam.poc,
                poam.pocTeam,
                poam.controlFamily,
                poam.remediationType,
                poam.remediationSignature
            ].join(' ').toLowerCase();

            return searchable.includes(normalizedQuery);
        });

        return {
            query: normalizedQuery,
            count: results.length,
            results
        };
    }

    async validate(data, type) {
        const errors = [];

        if (type === 'input') {
            if (!data || !Array.isArray(data.poams)) {
                errors.push('Input must include poams array');
            }
        }

        if (type === 'output') {
            if (!data || !Array.isArray(data.results)) {
                errors.push('Output must include results array');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
