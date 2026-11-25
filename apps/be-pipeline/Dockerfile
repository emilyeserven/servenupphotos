# syntax=docker/dockerfile:1
# Build context: apps/be-pipeline. Multi-arch friendly (e.g. linux/arm64 for Raspberry Pi).
# The final (default) stage is the production image; the `dev` stage is used by docker-compose.dev.yml.
FROM golang:1.27-alpine AS dev
# Chromium makes the Photo Book's PDFs (internal/bookpdf), with fonts for Helvetica and Arial's stand-ins and for Japanese, Chinese and Korean.
RUN apk add --no-cache exiftool chromium font-liberation font-noto font-noto-cjk
ENV CHROME_NO_SANDBOX=1
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
EXPOSE 8081
CMD ["go", "run", "./cmd/api"]

FROM --platform=$BUILDPLATFORM golang:1.27-alpine AS build
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
# Go's build cache survives between builds, so a change recompiles only the packages it touches instead of every
# dependency (the AWS SDK, the WEBP and AVIF encoders): minutes on a Raspberry Pi.
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# exiftool is a Perl program, so the runtime needs a distro that ships it (go-exiftool shells out to it).
FROM alpine:3.22
# Chromium makes the Photo Book's PDFs (internal/bookpdf), with fonts for Helvetica and Arial's stand-ins and for Japanese, Chinese and Korean.
RUN apk add --no-cache exiftool chromium font-liberation font-noto font-noto-cjk
# Chrome's sandbox can't start as nobody in a container; it only opens the book's own pages.
ENV CHROME_NO_SANDBOX=1
COPY --from=build /out/api /api
# Settings (including write-only secrets) live on the volume mounted here; nobody must own it to write.
RUN mkdir /data && chown nobody /data
ENV SETTINGS_FILE=/data/settings.json
USER nobody
EXPOSE 8081
ENTRYPOINT ["/api"]
