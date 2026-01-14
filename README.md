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
