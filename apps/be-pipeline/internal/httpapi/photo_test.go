package httpapi

import (
	"bytes"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"mime/multipart"
	"testing"
)

// redJPEG returns a small solid red JPEG.
func redJPEG(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 16, 16))
	draw.Draw(img, img.Bounds(), &image.Uniform{C: color.RGBA{255, 0, 0, 255}}, image.Point{}, draw.Src)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 100}); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// truncatedJPEG starts with the JPEG SOI/APP0 markers, enough for content
// sniffing but not for decoding.
var truncatedJPEG = []byte("\xff\xd8\xff\xe0\x00\x10JFIF\x00rest-of-image")

func multipartBody(t *testing.T, field, filename string, content []byte) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	fw, err := mw.CreateFormFile(field, filename)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = fw.Write(content)
	_ = mw.Close()
	return &buf, mw.FormDataContentType()
}
