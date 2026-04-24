import type { IntegrationServiceDef, IntegrationTool, IntegrationServiceId } from './types';

// ─── Shared mock delay ───────────────────────────────────────────────────────
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Google Services ─────────────────────────────────────────────────────────

export const GOOGLE_SERVICES: IntegrationServiceDef[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    provider: 'google',
    icon: '✉️',
    color: '#EA4335',
    category: 'Communication',
    description: 'Send emails, read inbox, create drafts, and manage labels.',
    scopes: ['gmail.send', 'gmail.readonly', 'gmail.labels'],
    tools: [
      {
        id: 'gmail_send',
        name: 'Send Email',
        icon: '📤',
        serviceId: 'gmail',
        description: 'Send an email to one or more recipients',
        parameters: [
          { name: 'to', type: 'string', description: 'Recipient email address(es)', required: true },
          { name: 'subject', type: 'string', description: 'Email subject line', required: true },
          { name: 'body', type: 'string', description: 'Email body (HTML or plain text)', required: true },
          { name: 'cc', type: 'string', description: 'CC email address(es)', required: false },
        ],
        execute: async (args) => { await delay(600); return { messageId: 'msg_' + Date.now(), status: 'sent', to: args.to }; },
      },
      {
        id: 'gmail_read',
        name: 'Read Emails',
        icon: '📥',
        serviceId: 'gmail',
        description: 'Fetch emails from inbox or by search query',
        parameters: [
          { name: 'query', type: 'string', description: 'Gmail search query (e.g. from:alice@example.com)', required: false },
          { name: 'maxResults', type: 'number', description: 'Max emails to return (default 10)', required: false },
        ],
        execute: async () => { await delay(500); return { emails: [{ id: '1', from: 'alice@example.com', subject: 'Q4 Report', snippet: 'Please review the attached...' }, { id: '2', from: 'bob@example.com', subject: 'Meeting Tomorrow', snippet: 'Can we push to 3pm?' }] }; },
      },
      {
        id: 'gmail_draft',
        name: 'Create Draft',
        icon: '📝',
        serviceId: 'gmail',
        description: 'Create an email draft without sending',
        parameters: [
          { name: 'to', type: 'string', description: 'Recipient email', required: true },
          { name: 'subject', type: 'string', description: 'Subject line', required: true },
          { name: 'body', type: 'string', description: 'Draft body', required: true },
        ],
        execute: async (args) => { await delay(400); return { draftId: 'draft_' + Date.now(), subject: args.subject }; },
      },
    ],
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    provider: 'google',
    icon: '📁',
    color: '#4285F4',
    category: 'Storage',
    description: 'Upload, search, and manage files and folders in Google Drive.',
    scopes: ['drive.readonly', 'drive.file', 'drive.metadata.readonly'],
    tools: [
      {
        id: 'drive_upload',
        name: 'Upload File',
        icon: '⬆️',
        serviceId: 'google_drive',
        description: 'Upload a file to Google Drive',
        parameters: [
          { name: 'fileName', type: 'string', description: 'Name of the file', required: true },
          { name: 'content', type: 'string', description: 'File content (text or base64)', required: true },
          { name: 'folderId', type: 'string', description: 'Target folder ID (optional)', required: false },
        ],
        execute: async (args) => { await delay(800); return { fileId: '1BxiM' + Date.now(), name: args.fileName, webViewLink: 'https://drive.google.com/file/d/...' }; },
      },
      {
        id: 'drive_search',
        name: 'Search Files',
        icon: '🔍',
        serviceId: 'google_drive',
        description: 'Search for files by name, type, or content',
        parameters: [
          { name: 'query', type: 'string', description: 'Search query', required: true },
          { name: 'mimeType', type: 'string', description: 'Filter by MIME type (e.g. application/pdf)', required: false },
        ],
        execute: async (args) => { await delay(500); return { files: [{ id: 'abc123', name: 'Report.pdf', modifiedTime: '2026-04-20T10:00:00Z', webViewLink: '#' }, { id: 'def456', name: args.query + '.docx', modifiedTime: '2026-04-19T08:00:00Z', webViewLink: '#' }] }; },
      },
      {
        id: 'drive_download',
        name: 'Get File',
        icon: '⬇️',
        serviceId: 'google_drive',
        description: 'Get file content or metadata by ID',
        parameters: [
          { name: 'fileId', type: 'string', description: 'Google Drive file ID', required: true },
        ],
        execute: async () => { await delay(600); return { content: 'File content retrieved successfully.', mimeType: 'text/plain' }; },
      },
    ],
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    provider: 'google',
    icon: '📅',
    color: '#0F9D58',
    category: 'Productivity',
    description: 'Create, list, and manage calendar events and meetings.',
    scopes: ['calendar.readonly', 'calendar.events'],
    tools: [
      {
        id: 'calendar_create',
        name: 'Create Event',
        icon: '➕',
        serviceId: 'google_calendar',
        description: 'Create a new calendar event',
        parameters: [
          { name: 'title', type: 'string', description: 'Event title', required: true },
          { name: 'start', type: 'string', description: 'Start time (ISO 8601)', required: true },
          { name: 'end', type: 'string', description: 'End time (ISO 8601)', required: true },
          { name: 'attendees', type: 'string', description: 'Comma-separated attendee emails', required: false },
          { name: 'description', type: 'string', description: 'Event description', required: false },
        ],
        execute: async (args) => { await delay(600); return { eventId: 'evt_' + Date.now(), title: args.title, htmlLink: 'https://calendar.google.com/event?eid=...' }; },
      },
      {
        id: 'calendar_list',
        name: 'List Events',
        icon: '📋',
        serviceId: 'google_calendar',
        description: 'Fetch upcoming calendar events',
        parameters: [
          { name: 'maxResults', type: 'number', description: 'Number of events to return', required: false },
          { name: 'timeMin', type: 'string', description: 'Start date filter (ISO 8601)', required: false },
        ],
        execute: async () => { await delay(400); return { events: [{ id: '1', summary: 'Quarterly Review', start: '2026-04-25T14:00:00Z', end: '2026-04-25T15:00:00Z' }, { id: '2', summary: 'Product Sync', start: '2026-04-26T10:00:00Z', end: '2026-04-26T10:30:00Z' }] }; },
      },
    ],
  },
  {
    id: 'google_sheets',
    name: 'Google Sheets',
    provider: 'google',
    icon: '📊',
    color: '#0F9D58',
    category: 'Data',
    description: 'Read and write data in Google Sheets spreadsheets.',
    scopes: ['spreadsheets', 'spreadsheets.readonly'],
    tools: [
      {
        id: 'sheets_read',
        name: 'Read Sheet',
        icon: '📖',
        serviceId: 'google_sheets',
        description: 'Read data from a spreadsheet range',
        parameters: [
          { name: 'spreadsheetId', type: 'string', description: 'Spreadsheet ID from the URL', required: true },
          { name: 'range', type: 'string', description: 'Range e.g. Sheet1!A1:D10', required: true },
        ],
        execute: async () => { await delay(500); return { values: [['Name', 'Revenue', 'Date'], ['ACME Corp', '125000', '2026-04'], ['Globex', '89000', '2026-04']], range: 'Sheet1!A1:C3' }; },
      },
      {
        id: 'sheets_write',
        name: 'Write to Sheet',
        icon: '✏️',
        serviceId: 'google_sheets',
        description: 'Write values to a spreadsheet range',
        parameters: [
          { name: 'spreadsheetId', type: 'string', description: 'Spreadsheet ID', required: true },
          { name: 'range', type: 'string', description: 'Range e.g. Sheet1!A1', required: true },
          { name: 'values', type: 'string', description: 'JSON array of rows e.g. [["a","b"],["c","d"]]', required: true },
        ],
        execute: async (args) => { await delay(500); return { updatedRange: args.range, updatedRows: 2, updatedCells: 4 }; },
      },
      {
        id: 'sheets_append',
        name: 'Append Row',
        icon: '➕',
        serviceId: 'google_sheets',
        description: 'Append a new row to a sheet',
        parameters: [
          { name: 'spreadsheetId', type: 'string', description: 'Spreadsheet ID', required: true },
          { name: 'range', type: 'string', description: 'Sheet range', required: true },
          { name: 'values', type: 'string', description: 'JSON array of cell values', required: true },
        ],
        execute: async () => { await delay(400); return { status: 'appended', updatedRows: 1 }; },
      },
    ],
  },
  {
    id: 'google_docs',
    name: 'Google Docs',
    provider: 'google',
    icon: '📄',
    color: '#4285F4',
    category: 'Documents',
    description: 'Create, read, and edit Google Docs documents.',
    scopes: ['documents', 'documents.readonly'],
    tools: [
      {
        id: 'docs_create',
        name: 'Create Document',
        icon: '📝',
        serviceId: 'google_docs',
        description: 'Create a new Google Doc with optional initial content',
        parameters: [
          { name: 'title', type: 'string', description: 'Document title', required: true },
          { name: 'content', type: 'string', description: 'Initial content (plain text or Markdown)', required: false },
        ],
        execute: async (args) => { await delay(700); return { documentId: 'doc_' + Date.now(), title: args.title, documentLink: 'https://docs.google.com/document/d/...' }; },
      },
      {
        id: 'docs_read',
        name: 'Read Document',
        icon: '📖',
        serviceId: 'google_docs',
        description: 'Read the content of a Google Doc',
        parameters: [
          { name: 'documentId', type: 'string', description: 'Document ID from the URL', required: true },
        ],
        execute: async () => { await delay(500); return { title: 'Q1 Strategy Doc', body: 'Executive summary: This document outlines the key strategic priorities for Q1 2026...', wordCount: 2847 }; },
      },
      {
        id: 'docs_append',
        name: 'Append to Document',
        icon: '➕',
        serviceId: 'google_docs',
        description: 'Add content to the end of a Google Doc',
        parameters: [
          { name: 'documentId', type: 'string', description: 'Document ID', required: true },
          { name: 'content', type: 'string', description: 'Content to append', required: true },
        ],
        execute: async (args) => { await delay(400); return { status: 'appended', documentId: args.documentId }; },
      },
    ],
  },
];

// ─── Microsoft Services ──────────────────────────────────────────────────────

export const MICROSOFT_SERVICES: IntegrationServiceDef[] = [
  {
    id: 'outlook',
    name: 'Outlook',
    provider: 'microsoft',
    icon: '📧',
    color: '#0078D4',
    category: 'Communication',
    description: 'Send and read Outlook emails, search messages, and manage folders.',
    scopes: ['Mail.Read', 'Mail.Send', 'Mail.ReadWrite'],
    tools: [
      {
        id: 'outlook_send',
        name: 'Send Email',
        icon: '📤',
        serviceId: 'outlook',
        description: 'Send an email via Outlook / Microsoft 365',
        parameters: [
          { name: 'to', type: 'string', description: 'Recipient email address(es)', required: true },
          { name: 'subject', type: 'string', description: 'Subject line', required: true },
          { name: 'body', type: 'string', description: 'Email body (HTML supported)', required: true },
        ],
        execute: async (args) => { await delay(600); return { messageId: 'AAkALgAA' + Date.now(), status: 'sent', to: args.to }; },
      },
      {
        id: 'outlook_read',
        name: 'Read Emails',
        icon: '📥',
        serviceId: 'outlook',
        description: 'Read emails from your inbox or a folder',
        parameters: [
          { name: 'folder', type: 'string', description: 'Folder (Inbox, SentItems, Drafts)', required: false },
          { name: 'maxResults', type: 'number', description: 'Number of emails to return', required: false },
        ],
        execute: async () => { await delay(500); return { messages: [{ id: '1', subject: 'Re: Partnership Proposal', from: 'partner@company.com', receivedDateTime: '2026-04-24T09:00:00Z' }] }; },
      },
      {
        id: 'outlook_search',
        name: 'Search Email',
        icon: '🔍',
        serviceId: 'outlook',
        description: 'Search emails by keyword or sender',
        parameters: [
          { name: 'query', type: 'string', description: 'Search query', required: true },
        ],
        execute: async (args) => { await delay(400); return { messages: [], query: args.query, totalEstimatedMatches: 14 }; },
      },
    ],
  },
  {
    id: 'teams',
    name: 'Microsoft Teams',
    provider: 'microsoft',
    icon: '💬',
    color: '#6264A7',
    category: 'Communication',
    description: 'Post messages to Teams channels, create meetings, and send direct messages.',
    scopes: ['ChannelMessage.Send', 'Chat.ReadWrite', 'OnlineMeetings.ReadWrite'],
    tools: [
      {
        id: 'teams_message',
        name: 'Send Channel Message',
        icon: '💬',
        serviceId: 'teams',
        description: 'Post a message to a Microsoft Teams channel',
        parameters: [
          { name: 'teamId', type: 'string', description: 'Team ID (from Teams URL)', required: true },
          { name: 'channelId', type: 'string', description: 'Channel ID', required: true },
          { name: 'message', type: 'string', description: 'Message content (Markdown supported)', required: true },
        ],
        execute: async () => { await delay(500); return { messageId: 'msg_' + Date.now(), status: 'sent' }; },
      },
      {
        id: 'teams_meeting',
        name: 'Create Meeting',
        icon: '📹',
        serviceId: 'teams',
        description: 'Schedule a Microsoft Teams online meeting',
        parameters: [
          { name: 'subject', type: 'string', description: 'Meeting subject', required: true },
          { name: 'start', type: 'string', description: 'Start time (ISO 8601)', required: true },
          { name: 'end', type: 'string', description: 'End time (ISO 8601)', required: true },
          { name: 'attendees', type: 'string', description: 'Attendee emails (comma-separated)', required: false },
        ],
        execute: async (args) => { await delay(700); return { meetingId: 'meet_' + Date.now(), subject: args.subject, joinUrl: 'https://teams.microsoft.com/l/meetup-join/...' }; },
      },
      {
        id: 'teams_dm',
        name: 'Send Direct Message',
        icon: '🗨️',
        serviceId: 'teams',
        description: 'Send a direct message to a Teams user',
        parameters: [
          { name: 'userId', type: 'string', description: 'User email or Teams user ID', required: true },
          { name: 'message', type: 'string', description: 'Message content', required: true },
        ],
        execute: async () => { await delay(400); return { chatId: 'chat_' + Date.now(), status: 'delivered' }; },
      },
    ],
  },
  {
    id: 'onedrive',
    name: 'OneDrive',
    provider: 'microsoft',
    icon: '☁️',
    color: '#0078D4',
    category: 'Storage',
    description: 'Upload, list, and download files in Microsoft OneDrive.',
    scopes: ['Files.Read', 'Files.ReadWrite', 'Files.ReadWrite.All'],
    tools: [
      {
        id: 'onedrive_upload',
        name: 'Upload File',
        icon: '⬆️',
        serviceId: 'onedrive',
        description: 'Upload a file to OneDrive',
        parameters: [
          { name: 'fileName', type: 'string', description: 'File name', required: true },
          { name: 'content', type: 'string', description: 'File content (text)', required: true },
          { name: 'path', type: 'string', description: 'Destination path e.g. /Documents/', required: false },
        ],
        execute: async (args) => { await delay(700); return { id: 'item_' + Date.now(), name: args.fileName, webUrl: 'https://onedrive.live.com/...' }; },
      },
      {
        id: 'onedrive_list',
        name: 'List Files',
        icon: '📋',
        serviceId: 'onedrive',
        description: 'List files in a OneDrive folder',
        parameters: [
          { name: 'path', type: 'string', description: 'Folder path (default: root)', required: false },
        ],
        execute: async () => { await delay(400); return { items: [{ name: 'Q4 Report.xlsx', size: 204800, lastModifiedDateTime: '2026-04-20T10:00:00Z' }, { name: 'Strategy.pptx', size: 512000, lastModifiedDateTime: '2026-04-18T14:00:00Z' }] }; },
      },
    ],
  },
  {
    id: 'sharepoint',
    name: 'SharePoint',
    provider: 'microsoft',
    icon: '🏢',
    color: '#038387',
    category: 'Documents',
    description: 'Access SharePoint sites, lists, and document libraries.',
    scopes: ['Sites.Read.All', 'Sites.ReadWrite.All'],
    tools: [
      {
        id: 'sp_list_items',
        name: 'Get List Items',
        icon: '📋',
        serviceId: 'sharepoint',
        description: 'Retrieve items from a SharePoint list',
        parameters: [
          { name: 'siteId', type: 'string', description: 'SharePoint site ID', required: true },
          { name: 'listId', type: 'string', description: 'List ID or name', required: true },
          { name: 'maxResults', type: 'number', description: 'Max items to return', required: false },
        ],
        execute: async () => { await delay(500); return { items: [{ id: 1, Title: 'Project Alpha', Status: 'Active', AssignedTo: 'alice@company.com' }], totalCount: 47 }; },
      },
      {
        id: 'sp_upload',
        name: 'Upload to Library',
        icon: '⬆️',
        serviceId: 'sharepoint',
        description: 'Upload a file to a SharePoint document library',
        parameters: [
          { name: 'siteId', type: 'string', description: 'Site ID', required: true },
          { name: 'libraryName', type: 'string', description: 'Document library name', required: true },
          { name: 'fileName', type: 'string', description: 'File name', required: true },
          { name: 'content', type: 'string', description: 'File content', required: true },
        ],
        execute: async (args) => { await delay(700); return { status: 'uploaded', fileName: args.fileName, webUrl: 'https://company.sharepoint.com/...' }; },
      },
      {
        id: 'sp_search',
        name: 'Search SharePoint',
        icon: '🔍',
        serviceId: 'sharepoint',
        description: 'Full-text search across SharePoint content',
        parameters: [
          { name: 'query', type: 'string', description: 'Search query', required: true },
        ],
        execute: async (args) => { await delay(500); return { results: [{ title: 'Matching Document', path: '/sites/team/docs/...', summary: `Content matching "${args.query}"...` }], totalResults: 8 }; },
      },
    ],
  },
  {
    id: 'excel',
    name: 'Excel Online',
    provider: 'microsoft',
    icon: '📈',
    color: '#217346',
    category: 'Data',
    description: 'Read and write Excel workbooks stored in OneDrive or SharePoint.',
    scopes: ['Files.ReadWrite'],
    tools: [
      {
        id: 'excel_read',
        name: 'Read Worksheet',
        icon: '📖',
        serviceId: 'excel',
        description: 'Read data from an Excel worksheet',
        parameters: [
          { name: 'fileId', type: 'string', description: 'OneDrive file ID of the workbook', required: true },
          { name: 'worksheet', type: 'string', description: 'Worksheet name', required: true },
          { name: 'range', type: 'string', description: 'Cell range e.g. A1:D10', required: false },
        ],
        execute: async () => { await delay(500); return { values: [['Month', 'Revenue', 'Expenses'], ['Jan', 120000, 45000], ['Feb', 185000, 52000]], address: 'A1:C3' }; },
      },
      {
        id: 'excel_write',
        name: 'Write to Worksheet',
        icon: '✏️',
        serviceId: 'excel',
        description: 'Write data to an Excel worksheet',
        parameters: [
          { name: 'fileId', type: 'string', description: 'OneDrive file ID', required: true },
          { name: 'worksheet', type: 'string', description: 'Worksheet name', required: true },
          { name: 'range', type: 'string', description: 'Starting cell e.g. A1', required: true },
          { name: 'values', type: 'string', description: 'JSON array of rows', required: true },
        ],
        execute: async (args) => { await delay(500); return { updatedRange: args.range, updatedRows: 3 }; },
      },
    ],
  },
];

// ─── All services combined ────────────────────────────────────────────────────

export const ALL_SERVICES = [...GOOGLE_SERVICES, ...MICROSOFT_SERVICES];

export function getService(serviceId: IntegrationServiceId): IntegrationServiceDef | undefined {
  return ALL_SERVICES.find((s) => s.id === serviceId);
}

export function getAllTools(): IntegrationTool[] {
  return ALL_SERVICES.flatMap((s) => s.tools);
}

// ─── Setup & Documentation guides ────────────────────────────────────────────

interface DocStep {
  step: number;
  title: string;
  body: string;
  code?: string;
  tip?: string;
}

export const INTEGRATION_DOCS: Record<IntegrationServiceId, DocStep[]> = {
  gmail: [
    { step: 1, title: 'Create a Google Cloud Project', body: 'Go to console.cloud.google.com → New Project. Name it something like "TeamForge Integration".', tip: 'Reuse an existing project if you already have one for your org.' },
    { step: 2, title: 'Enable Gmail API', body: 'In your project go to APIs & Services → Library. Search "Gmail API" and click Enable.' },
    { step: 3, title: 'Configure OAuth Consent Screen', body: 'Go to APIs & Services → OAuth consent screen. Choose External (or Internal for Google Workspace). Fill in the app name and developer contact email.' },
    { step: 4, title: 'Create OAuth 2.0 Credentials', body: 'Go to Credentials → Create Credentials → OAuth client ID. Select "Web application". Add your redirect URI:', code: 'http://localhost:3000/oauth/google/callback' },
    { step: 5, title: 'Copy Client ID & Secret', body: 'Paste your Client ID and Client Secret into the Settings → API Keys section in TeamForge.' },
  ],
  google_drive: [
    { step: 1, title: 'Enable Google Drive API', body: 'In your Google Cloud project, go to APIs & Services → Library and enable "Google Drive API". You can reuse the same project as Gmail.' },
    { step: 2, title: 'Add Drive Scopes', body: 'In OAuth consent screen → Scopes, add: drive.readonly and drive.file. For full access, add drive.', tip: 'Only request the scopes your agents actually need — narrower scopes get approved faster by users.' },
    { step: 3, title: 'Connect via OAuth', body: 'Click Connect and authorize with your Google account. You will be prompted to grant the Drive permissions specified above.' },
  ],
  google_calendar: [
    { step: 1, title: 'Enable Calendar API', body: 'In your Google Cloud project library, search for "Google Calendar API" and enable it.' },
    { step: 2, title: 'Add Calendar Scopes', body: 'Add scopes calendar.readonly (for listing events) and calendar.events (for creating/editing events).' },
    { step: 3, title: 'Connect your Calendar', body: 'Click Connect and authorize. You can choose which calendars to grant access to in the Google consent screen.' },
  ],
  google_sheets: [
    { step: 1, title: 'Enable Sheets API', body: 'Enable "Google Sheets API" in the Google Cloud Console library.' },
    { step: 2, title: 'Add Sheets Scopes', body: 'Add scope: https://www.googleapis.com/auth/spreadsheets for read/write, or spreadsheets.readonly for read-only.' },
    { step: 3, title: 'Find Your Spreadsheet ID', body: 'The Spreadsheet ID is in the URL between /d/ and /edit:', code: 'docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit', tip: 'Agents can reference this ID in tool parameters to read or write specific sheets.' },
  ],
  google_docs: [
    { step: 1, title: 'Enable Google Docs API', body: 'Search for "Google Docs API" in the Cloud Console Library and enable it.' },
    { step: 2, title: 'Add Docs Scopes', body: 'Add scope: https://www.googleapis.com/auth/documents. For read-only access use documents.readonly.' },
    { step: 3, title: 'Find Document IDs', body: 'The Document ID is in the URL between /d/ and /edit:', code: 'docs.google.com/document/d/{DOCUMENT_ID}/edit', tip: 'Agents can also create new documents on the fly and return the document URL as output.' },
  ],
  outlook: [
    { step: 1, title: 'Register App in Azure Active Directory', body: 'Go to portal.azure.com → Azure Active Directory → App registrations → New registration. Set the redirect URI:', code: 'http://localhost:3000/oauth/microsoft/callback' },
    { step: 2, title: 'Add Microsoft Graph Permissions', body: 'In your app registration, go to API Permissions → Add a Permission → Microsoft Graph → Delegated. Add: Mail.Read, Mail.Send, User.Read.' },
    { step: 3, title: 'Create Client Secret', body: 'Go to Certificates & Secrets → New client secret. Copy the value immediately — it won\'t be shown again.', tip: 'Set a calendar reminder before the secret expires (choose 24 months).' },
    { step: 4, title: 'Copy Tenant ID, Client ID & Secret', body: 'From the Overview page copy the Application (client) ID and Directory (tenant) ID. Paste these in TeamForge Settings → API Keys.' },
    { step: 5, title: 'Grant Admin Consent', body: 'In API Permissions, click "Grant admin consent for [Your Org]" if you have admin privileges. Users will consent individually otherwise.' },
  ],
  teams: [
    { step: 1, title: 'Use Existing Azure App Registration', body: 'You can reuse the same Azure app you registered for Outlook — just add Teams-specific permissions to it.' },
    { step: 2, title: 'Add Teams Permissions', body: 'In Microsoft Graph delegated permissions add: ChannelMessage.Send, Chat.ReadWrite, OnlineMeetings.ReadWrite, Team.ReadBasic.All.' },
    { step: 3, title: 'Find Team and Channel IDs', body: 'In Teams desktop, right-click a channel and choose "Get link to channel". The IDs are in the URL.', tip: 'Use the Microsoft Graph Explorer (graph.microsoft.com) to browse your teams and channels and find their IDs easily.' },
  ],
  onedrive: [
    { step: 1, title: 'Add OneDrive Permissions', body: 'In your Azure app registration, add Files.Read and Files.ReadWrite permissions from Microsoft Graph. If you already set up Outlook these permissions are in the same app.' },
    { step: 2, title: 'Personal vs Business', body: 'OneDrive works for personal Microsoft accounts and Microsoft 365 business. Make sure your Azure app supports the right account types (set during app registration under Supported account types).', tip: 'For business OneDrive, choose "Accounts in this organizational directory only". For personal, choose "Personal Microsoft accounts only".' },
    { step: 3, title: 'Connect via OAuth', body: 'Click Connect below. You will be redirected to Microsoft to authorize file access.' },
  ],
  sharepoint: [
    { step: 1, title: 'Add SharePoint Permissions', body: 'In your Azure app, add Sites.Read.All and Sites.ReadWrite.All from Microsoft Graph permissions.' },
    { step: 2, title: 'Grant Admin Consent', body: 'SharePoint permissions typically require tenant admin consent. Ask your IT admin to click "Grant admin consent" in Azure Active Directory.', tip: 'Without admin consent, the connection will fail with an AADSTS error.' },
    { step: 3, title: 'Find Site and List IDs', body: 'Use the Microsoft Graph API to find your site ID:', code: 'GET https://graph.microsoft.com/v1.0/sites/company.sharepoint.com:/sites/YourSite', tip: 'The Graph Explorer at graph.microsoft.com is the easiest way to browse SharePoint and find site/list IDs.' },
  ],
  excel: [
    { step: 1, title: 'Use OneDrive Connection', body: 'Excel Online uses the same OneDrive permissions (Files.ReadWrite). If you already connected OneDrive, Excel will work automatically with no extra setup.' },
    { step: 2, title: 'Find the Excel File ID', body: 'Open the Excel file in OneDrive, then use the Graph API to find its item ID:', code: 'GET https://graph.microsoft.com/v1.0/me/drive/root/children', tip: 'The file ID looks like: 01ABC123DEF456GHI789... — copy it from the id field in the API response.' },
    { step: 3, title: 'Reference File ID in Tools', body: 'Use the file ID in the fileId parameter when calling Excel read/write tools in your agents or flows.' },
  ],
};
