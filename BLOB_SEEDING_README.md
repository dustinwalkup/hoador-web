# Message Attachments Blob Seeding

## Overview

The message attachments seeding has been updated to use real Vercel Blob storage instead of placeholder URLs. This provides a fully functional attachment system for testing and development.

## How It Works

1. **Real File Upload**: The seed script reads actual image files from `public/images/mock/tools/` and uploads them to Vercel Blob storage
2. **Real URLs**: Database is seeded with actual blob URLs that can be downloaded
3. **Fallback Handling**: If blob upload fails, falls back to placeholder URLs with error logging

## Prerequisites

- Vercel Blob storage configured with proper environment variables
- `BLOB_READ_WRITE_TOKEN` environment variable set
- Mock images available in `public/images/mock/tools/`

## Usage

### 1. Test Blob Upload (Optional)

Before running the full seed, test blob functionality:

```bash
npm run test:blob
```

This will:

- Upload a test image to blob storage
- Verify the upload was successful
- Test file accessibility via URL

### 2. Run Full Seed

```bash
npm run seed
```

This will:

- Clear existing message attachments
- Upload sample files to blob storage
- Seed the database with real blob URLs
- Create realistic attachment metadata

### 3. Verify Results

After seeding:

- Check the console output for upload success messages
- Visit the mailbox to see attachments with real download functionality
- Test downloading attachments - they should work immediately

## File Types Supported

The seeding creates attachments with these types:

- **Images**: JPEG, PNG, WebP files from mock tools
- **PDFs**: Using mock images as placeholders
- **Documents**: Using mock images as placeholders
- **Spreadsheets**: Using mock images as placeholders
- **Text**: Using mock images as placeholders

## Benefits

✅ **Real Functionality**: Attachments actually download  
✅ **Proper Testing**: Full download flow can be tested  
✅ **Production Ready**: Same blob storage pattern as production  
✅ **Better Development**: No more "Not Found" errors

## Troubleshooting

### Blob Upload Fails

If you see "Failed to upload sample file" errors:

1. Check `BLOB_READ_WRITE_TOKEN` environment variable
2. Verify Vercel Blob is properly configured
3. Check network connectivity
4. Review blob storage quotas

### Files Not Accessible

If uploaded files can't be accessed:

1. Verify blob storage permissions
2. Check if files were uploaded to correct region
3. Review blob storage configuration

## Cost Considerations

⚠️ **Note**: Each seed run uploads files to blob storage, which may incur costs:

- Storage costs for uploaded files
- Bandwidth costs for downloads
- Consider cleaning up test files periodically

## Cleanup

To remove test files from blob storage:

```typescript
import { deleteFromBlob } from "@/services/vercel-blob";

// Delete specific files by pathname
await deleteFromBlob("message-attachments/test-file.jpg");
```

## Next Steps

After successful seeding:

1. Test attachment downloads in the mailbox
2. Proceed with Stage 4: Upload Infrastructure
3. Implement file upload functionality for users
