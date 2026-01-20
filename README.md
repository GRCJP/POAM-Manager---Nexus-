# POAM Nexus - Management Dashboard

A comprehensive Plan of Action and Milestones (POA&M) management system for security compliance tracking and remediation.

## Features

### Dashboard
- **System Security Posture Overview**: Real-time metrics and KPIs
- **Management Modules**: Quick access to all functional areas
- **Responsive Design**: Optimized for desktop and mobile devices

### POAM Repository
- **Complete CRUD Operations**: Create, read, update, and delete POAM entries
- **Advanced Filtering**: Search by ID, risk level, and status
- **Risk Level Classification**: Critical, High, Medium, Low categorization
- **Status Tracking**: Open, In Progress, Completed, Overdue monitoring

### Evidence Vault
- **File Upload System**: Drag-and-drop or click-to-browse functionality
- **Document Management**: Support for PDFs, images, and office documents
- **POAM Linking**: Associate evidence files with specific findings
- **File Type Recognition**: Automatic icon assignment based on file type

### Executive Reporting
- **Report Generation**: Multiple report formats for different audiences
- **Access Control**: Restricted module requiring elevated permissions
- **Export Capabilities**: Download reports in various formats
- **Compliance Focus**: Regulatory submission and executive summary options

### Additional Modules
- **Reports & Analytics**: Data visualization and trend analysis
- **Audit Logs**: Complete system activity tracking
- **Settings**: User preferences and configuration management

### Security Control Monitoring (POAM Workbook)
- **Purpose**: Workbook-based POAM tracking that is isolated from vulnerability scan upload processing and the phased scan pipeline.
- **UI Location**: Sidebar → Vulnerability Management → Security Control Monitoring.
- **Data Storage Isolation**: Uses a separate IndexedDB database named `POAMWorkbookDB` with dedicated stores:
  - `poamWorkbookItems` (workbook-native records)
  - `poamWorkbookSystems`
  - `poamWorkbookLookups` (POCs, security controls, enums)
- **Import/Export Isolation**:
  - Workbook XLSX import/export applies only to `POAMWorkbookDB`.
  - Scan upload processing applies only to the scan pipeline and its stores.

#### Workbook Columns (authoritative)
Workbook import/export uses the exact column headers and order defined in `poam-workbook-constants.js`:
1. Item number
2. Vulnerability Name
3. Vulnerability Description
4. Detection Date
5. Impacted Security Controls
6. Office/Org
7. POC Name
8. Identifying Detecting Source
9. Mitigations
10. Severity Value
11. Resources Required
12. Scheduled Completion Date
13. Milestone with Completion Dates
14. Milestone Changes
15. Affected Components/URLs
16. Status
17. Comments

#### Workbook-only field: Assets Impacted
`Assets Impacted` is stored internally on workbook items, but is not exported as a separate column.

Export mapping rule:
- If `Assets Impacted` is non-empty, it is appended into `Affected Components/URLs` as a block:
  - `Assets Impacted:`
  - `<value>`

On import, if `Affected Components/URLs` contains an `Assets Impacted:` block, it is parsed back into the internal `Assets Impacted` field.

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS for modern, responsive design
- **Icons**: Font Awesome for comprehensive icon library
- **Architecture**: Single-page application with modular navigation

## File Structure

```
POAM Manager/
├── index.html          # Main application file
├── script.js           # JavaScript functionality
└── README.md           # This documentation
```

## Getting Started

1. **Download the Files**: Ensure all three files are in the same directory
2. **Open in Browser**: Launch `index.html` in a modern web browser
3. **Navigate the Dashboard**: Click on module cards to access different areas

## Usage Guide

### Dashboard Navigation
- Click on module cards to access specific functional areas
- Use the top navigation bar for quick access to reports, audit logs, and settings
- Monitor key metrics in the dashboard widgets

### POAM Management
1. **Create New POAM**: Click "New POAM" button in the repository
2. **Edit Existing**: Use the edit icon in each table row
3. **Filter Results**: Use search and dropdown filters to find specific items
4. **View Details**: Click the eye icon to see complete POAM information

### Evidence Upload
1. **Drag and Drop**: Simply drag files onto the upload area
2. **Browse Files**: Click "Choose Files" to select from your system
3. **File Association**: Evidence is automatically linked to POAM items

### Reporting
- Access different report types from the Executive Reporting module
- Note: Some reports require elevated permissions (simulated in demo)

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Security Features

- **Access Control**: Role-based permissions for sensitive modules
- **Audit Trail**: Complete logging of all system activities
- **Data Validation**: Input validation and sanitization
- **Session Management**: Secure navigation and state management

## Customization

### Adding New POAM Fields
1. Modify the modal form in `index.html`
2. Update the `savePOAM()` function in `script.js`
3. Adjust the table structure and display logic

### Styling Changes
- Modify Tailwind CSS classes directly in HTML
- Add custom CSS rules in a separate stylesheet if needed
- Update color schemes by modifying Tailwind color utilities

### New Report Types
1. Add new report cards to the Executive Reporting module
2. Implement the `exportReport()` function for each new type
3. Configure access permissions as needed

## Development Notes

This is a frontend-only demonstration. In a production environment, you would need:

- **Backend API**: RESTful services for data persistence
- **Database**: Secure storage for POAM data and evidence files
- **Authentication**: User login and session management
- **File Storage**: Secure cloud or on-premise file storage
- **Email Integration**: Automated notifications and reports

## License

This project is provided as a demonstration of modern web development capabilities for security compliance management.

## Support

For questions about this demonstration or implementation guidance, please refer to the code comments and documentation within the files.
