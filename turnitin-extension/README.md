# Plagaiscans Turnitin Automation Extension

This Chrome/Edge browser extension automatically processes documents from your Plagaiscans queue through Turnitin.com.

## Features

- 🔄 **Automatic Processing**: Polls for pending documents and processes them automatically
- 📄 **Full Automation**: Logs into Turnitin, uploads files, waits for results, downloads reports
- 📊 **Report Upload**: Automatically uploads AI and Similarity reports back to Plagaiscans
- 🔔 **Notifications**: Get notified when documents are processed
- 🔐 **Secure**: Credentials stored locally in your browser only

## Installation

### Step 1: Download the Extension

1. Download or clone this folder to your computer

### Step 2: Load in Chrome/Edge

1. Open Chrome and go to `chrome://extensions/` (or `edge://extensions/` for Edge)
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select this `turnitin-extension` folder
5. The extension icon should appear in your toolbar

### Step 3: Add Extension Icons

Create icon files or use placeholder icons:
- Create a folder called `icons` inside the extension folder
- Add PNG files: `icon16.png`, `icon48.png`, `icon128.png`

### Step 4: Configure the Extension

1. Click the extension icon in your toolbar
2. Click **Settings** to open the options page
3. Enter your **Turnitin credentials** (email and password)
4. Enter the **Service Role Key** (get this from your Plagaiscans admin)
5. Save the settings

## Usage

1. **Keep the browser open** - the extension needs Chrome/Edge running to work
2. **Toggle Auto-Processing** - click the extension icon and toggle on/off
3. **Monitor progress** - the popup shows current status and processing history

## How It Works

1. The extension polls your Plagaiscans database every 10 seconds for pending documents
2. When found, it downloads the file and opens Turnitin.com in a background tab
3. It automates:
   - Login (if needed)
   - Navigating to the submission page
   - Uploading the document
   - Waiting for processing (can take several minutes)
   - Downloading the AI and Similarity reports
4. Reports are uploaded back to Plagaiscans storage
5. The document status is updated to "completed"

## Troubleshooting

### "Credentials not configured"
- Go to Settings and enter your Turnitin email and password

### "Service key not configured"  
- Contact your Plagaiscans admin for the service role key

### Documents not processing
- Make sure auto-processing is enabled (check the toggle)
- Ensure Chrome/Edge is running and not sleeping
- Check for errors in the popup

### Login failing
- Verify your Turnitin credentials are correct
- Try logging into Turnitin manually first to check for any account issues

## Security Notes

- Your Turnitin credentials are **stored locally** in Chrome's secure storage
- Credentials are **never sent** to Plagaiscans servers
- The service key provides backend access to manage documents
- Revoke the service key if you suspect any compromise

## Requirements

- Google Chrome or Microsoft Edge (Chromium-based)
- Active Turnitin account with login credentials
- Computer must remain on with browser open
- Stable internet connection

## Updating

To update the extension:
1. Replace the extension files with the new version
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card

## Support

Need help? Contact support at: [Plagaiscans Contact](https://plagaiscans.lovable.app/contact)
