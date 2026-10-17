package versions

import (
	"bufio"
	"encoding/binary"
	"io"
)

// stdLuminanceSum is the sum of the JPEG standard's luminance quantization
// table (ITU-T T.81, Annex K), which encoders like libjpeg scale by quality.
const stdLuminanceSum = 3688

// FallbackJPEGQuality is used when a photo's own quality can't be told.
const FallbackJPEGQuality = 90

// JPEGQuality estimates the quality setting a JPEG was saved at, from 1 to
// 100, by comparing its luminance quantization table with the standard one,
// the same way tools like ImageMagick do. Encoders with their own tables,
// like Lightroom's, get the nearest libjpeg quality. ok is false when the
// JPEG has no 8-bit luminance table before its image data.
func JPEGQuality(r io.Reader) (quality int, ok bool) {
	br := bufio.NewReader(r)
	if b, err := readN(br, 2); err != nil || b[0] != 0xFF || b[1] != 0xD8 {
		return 0, false
	}
	for {
		marker, err := nextMarker(br)
		if err != nil || marker == 0xDA || marker == 0xD9 { // start of scan, end of image
			return 0, false
		}
		head, err := readN(br, 2)
		if err != nil {
			return 0, false
		}
		segment, err := readN(br, int(binary.BigEndian.Uint16(head))-2)
		if err != nil {
			return 0, false
		}
		if marker == 0xDB {
			if q, found := luminanceQuality(segment); found {
				return q, true
			}
		}
	}
}

// nextMarker skips to the next marker and returns its code.
func nextMarker(br *bufio.Reader) (byte, error) {
	for {
		b, err := br.ReadByte()
		if err != nil {
			return 0, err
		}
		if b != 0xFF {
			continue
		}
		code, err := br.ReadByte()
		for err == nil && code == 0xFF {
			code, err = br.ReadByte()
		}
		if err != nil {
			return 0, err
		}
		if code != 0x00 {
			return code, nil
		}
	}
}

// luminanceQuality finds table 0 in a DQT segment, which may hold several
// tables, and turns it into a quality.
func luminanceQuality(segment []byte) (int, bool) {
	for len(segment) > 0 {
		precision, id := segment[0]>>4, segment[0]&0x0F
		size := 64
		if precision != 0 {
			size = 128
		}
		if len(segment) < 1+size {
			return 0, false
		}
		if id == 0 && precision == 0 {
			sum := 0
			for _, v := range segment[1 : 1+size] {
				sum += int(v)
			}
			return qualityFromScale(sum * 100 / stdLuminanceSum), true
		}
		segment = segment[1+size:]
	}
	return 0, false
}

// qualityFromScale inverts libjpeg's quality scaling: quality q scales the
// standard table by 5000/q percent below 50 and by 200-2q percent above.
func qualityFromScale(scale int) int {
	var q int
	switch {
	case scale <= 0:
		q = 100
	case scale <= 100:
		q = (200 - scale + 1) / 2
	default:
		q = 5000 / scale
	}
	return min(max(q, 1), 100)
}

func readN(br *bufio.Reader, n int) ([]byte, error) {
	if n < 0 {
		return nil, io.ErrUnexpectedEOF
	}
	b := make([]byte, n)
	_, err := io.ReadFull(br, b)
	return b, err
}
