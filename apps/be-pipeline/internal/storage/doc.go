// Package storage will handle uploading optimized and cropped images to
// Cloudflare R2.
//
// R2 is S3-compatible, so the planned implementation is aws-sdk-go-v2's S3
// client pointed at https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com, configured
// from the R2_* variables in the repository's .env.example. Nothing is
// implemented yet.
package storage
