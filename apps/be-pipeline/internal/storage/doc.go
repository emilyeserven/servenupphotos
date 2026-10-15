// Package storage talks to Cloudflare R2, where optimized and cropped images
// are uploaded.
//
// R2 is S3-compatible, so it uses aws-sdk-go-v2's S3 client pointed at
// https://<accountId>.r2.cloudflarestorage.com, configured from the R2
// settings. For now it only checks that those settings can reach the bucket.
package storage
