# syntax=docker/dockerfile:1
# Build context: apps/be-pipeline. Multi-arch friendly (e.g. linux/arm64 for Raspberry Pi).
# The final (default) stage is the production image; the `dev` stage is used by docker-compose.dev.yml.
FROM golang:1.24-alpine AS dev
RUN apk add --no-cache exiftool
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
EXPOSE 8081
CMD ["go", "run", "./cmd/api"]

FROM --platform=$BUILDPLATFORM golang:1.24-alpine AS build
ARG TARGETOS TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# exiftool is a Perl program, so the runtime needs a distro that ships it (go-exiftool shells out to it).
FROM alpine:3.22
RUN apk add --no-cache exiftool
COPY --from=build /out/api /api
# Settings (including write-only secrets) live on the volume mounted here; nobody must own it to write.
RUN mkdir /data && chown nobody /data
ENV SETTINGS_FILE=/data/settings.json
USER nobody
EXPOSE 8081
ENTRYPOINT ["/api"]
