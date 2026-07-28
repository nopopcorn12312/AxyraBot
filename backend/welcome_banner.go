package main

import (
	"bytes"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/fogleman/gg"
	"github.com/golang/freetype/truetype"
	xdraw "golang.org/x/image/draw"
	xfont "golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/goregular"
)

// Banner dimensions and layout constants.
const (
	wbWidth  = 700
	wbHeight = 175

	// Avatar circle
	avatarSize = 100  // diameter in px
	avatarR    = 50.0 // radius
	avatarCX   = 80.0 // centre x
	avatarCY   = 87   // centre y  (wbHeight / 2, truncated)

	// Text column starts to the right of the avatar ring + gap
	textX = avatarCX + avatarR + 22 // = 152

	// Horizontal centre of the right-hand text region
	// so all lines appear centred in the available space.
	textCX = (textX + (wbWidth - 20)) / 2 // = 416
)

// GenerateWelcomeBanner creates a PNG welcome card styled to match the site
// colour scheme (background #020617, accent #38bdf8 sky-blue).
func GenerateWelcomeBanner(avatarURL, username, serverName string, memberCount int) ([]byte, error) {
	dc := gg.NewContext(wbWidth, wbHeight)

	// ── Background ──────────────────────────────────────────────────────────
	dc.SetHexColor("020617")
	dc.Clear()

	// Very subtle accent-tinted inner wash to add depth.
	dc.SetRGBA(0.22, 0.75, 0.98, 0.05)
	dc.DrawRoundedRectangle(0, 0, wbWidth, wbHeight, 16)
	dc.Fill()

	// ── Border ──────────────────────────────────────────────────────────────
	// Outer soft glow (3 passes, decreasing opacity)
	for i := 3; i >= 1; i-- {
		dc.SetRGBA(0.22, 0.75, 0.98, 0.04*float64(i))
		offset := float64(i) * 2
		dc.DrawRoundedRectangle(2-offset, 2-offset, wbWidth-4+offset*2, wbHeight-4+offset*2, 16+offset)
		dc.Stroke()
	}
	// Solid accent border
	dc.SetHexColor("38bdf8")
	dc.SetLineWidth(4)
	dc.DrawRoundedRectangle(2, 2, wbWidth-4, wbHeight-4, 14)
	dc.Stroke()

	// ── Avatar ──────────────────────────────────────────────────────────────
	avatarImg := fetchResizedAvatar(avatarURL, avatarSize)
	if avatarImg != nil {
		dc.Push()
		dc.DrawCircle(avatarCX, avatarCY, avatarR)
		dc.Clip()
		dc.DrawImageAnchored(avatarImg, int(avatarCX), int(avatarCY), 0.5, 0.5)
		dc.Pop()
	}

	// Avatar ring
	dc.SetHexColor("38bdf8")
	dc.SetLineWidth(3)
	dc.DrawCircle(avatarCX, avatarCY, avatarR+2)
	dc.Stroke()

	// Subtle vertical separator between avatar and text area
	dc.SetRGBA(0.22, 0.75, 0.98, 0.25)
	dc.SetLineWidth(1)
	dc.DrawLine(textX-10, 28, textX-10, wbHeight-28)
	dc.Stroke()

	// ── Text (each line centred in the right region at textCX) ──────────────
	// Username — gobold 26pt, near-white (#f1f5f9)
	if face, err := parseTTFFace(gobold.TTF, 26); err == nil {
		dc.SetFontFace(face)
	}
	dc.SetHexColor("f1f5f9")
	dc.DrawStringAnchored(username, textCX, 72, 0.5, 1)

	// Truncate server name if very long
	displayServer := serverName
	if len([]rune(displayServer)) > 22 {
		displayServer = string([]rune(displayServer)[:20]) + "…"
	}

	// "Welcome to [Server]!" — goregular 17pt, accent sky-blue (#38bdf8)
	if face, err := parseTTFFace(goregular.TTF, 17); err == nil {
		dc.SetFontFace(face)
	}
	dc.SetHexColor("38bdf8")
	dc.DrawStringAnchored("Welcome to "+displayServer+"!", textCX, 99, 0.5, 1)

	// Member count — goregular 13pt, slate-500 (#64748b)
	if face, err := parseTTFFace(goregular.TTF, 13); err == nil {
		dc.SetFontFace(face)
	}
	dc.SetHexColor("64748b")
	dc.DrawStringAnchored(fmt.Sprintf("Member #%d", memberCount), textCX, 120, 0.5, 1)

	var buf bytes.Buffer
	if err := dc.EncodePNG(&buf); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// parseTTFFace parses TTF bytes and returns a font.Face at the requested size (pt @ 72 DPI).
func parseTTFFace(data []byte, sizePt float64) (xfont.Face, error) {
	f, err := truetype.Parse(data)
	if err != nil {
		return nil, err
	}
	return truetype.NewFace(f, &truetype.Options{
		Size:    sizePt,
		DPI:     72,
		Hinting: xfont.HintingFull,
	}), nil
}

// fetchResizedAvatar downloads an avatar image and scales it to size×size pixels.
// Returns nil on any error so callers can still send a banner without the avatar.
func fetchResizedAvatar(url string, size int) image.Image {
	if url == "" {
		return nil
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		log.Printf("[Banner] avatar fetch error: %v", err)
		return nil
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil
	}
	src, _, err := image.Decode(bytes.NewReader(body))
	if err != nil {
		log.Printf("[Banner] avatar decode error: %v", err)
		return nil
	}
	dst := image.NewRGBA(image.Rect(0, 0, size, size))
	xdraw.BiLinear.Scale(dst, dst.Bounds(), src, src.Bounds(), xdraw.Over, nil)
	return dst
}
