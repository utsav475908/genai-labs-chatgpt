# Builds the showcase shell and every enabled lab's Next.js UI as static files,
# then serves them all (plus the API reverse proxy) from one Caddy container.
FROM node:22-alpine AS build
WORKDIR /repo
COPY . .
RUN node showcase/deploy/build-static.mjs /out

FROM caddy:2-alpine
COPY --from=build /out /srv
