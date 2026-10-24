#!/bin/bash
# Netlify-mode simulation test for CooCoo Radio 24x7
# Simulates the serverless environment: NETLIFY=1, DB in /tmp, uploads in /tmp/uploads
set -uo pipefail

PORT=3001
BASE="http://localhost:$PORT"
PASS=0; FAIL=0

ok()  { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }

check() { # name, expected, actual
  if [ "$2" = "$3" ]; then ok "$1 ($3)"; else bad "$1 — expected $2, got $3"; fi
}

echo "=== 1. Homepage renders ==="
code=$(curl -s -o /tmp/nl-home.html -w "%{http_code}" "$BASE/")
check "GET /" "200" "$code"
rg -q "CooCoo" /tmp/nl-home.html && ok "HTML contains CooCoo" || bad "HTML missing CooCoo"

echo "=== 2. Public APIs ==="
for ep in songs news shows ads settings chat; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/$ep")
  check "GET /api/$ep" "200" "$code"
done
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/messages")
check "GET /api/messages (admin-only inbox)" "401" "$code"

echo "=== 3. Admin login (bundled DB creds) ==="
login=$(curl -s -X POST "$BASE/api/admin/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}')
token=$(echo "$login" | rg -o '"token":"[^"]+"' | cut -d'"' -f4)
[ -n "$token" ] && ok "login returned token" || bad "login failed: $login"

echo "=== 4. Runtime upload -> /api/media ==="
head -c 2048 /dev/urandom > /tmp/nl-test.mp3
up=$(curl -s -X POST "$BASE/api/songs" -H "x-admin-token: $token" \
  -F 'file=@/tmp/nl-test.mp3;type=audio/mpeg' -F 'title=Netlify Test Song' -F 'artist=Tester')
echo "   upload resp: $up"
song_url=$(echo "$up" | rg -o '"url":"[^"]+"' | cut -d'"' -f4)
song_id=$(echo "$up" | rg -o '"id":"[^"]+"' | cut -d'"' -f4)
[[ "$song_url" == /api/media/* ]] && ok "upload URL uses /api/media ($song_url)" || bad "unexpected upload URL: $song_url"

mcode=$(curl -s -o /tmp/nl-media-out.bin -w "%{http_code}" "$BASE$song_url")
check "GET $song_url" "200" "$mcode"
mtype=$(curl -s -o /dev/null -w "%{content_type}" "$BASE$song_url")
check "media content-type" "audio/mpeg" "$mtype"
msize=$(stat -c%s /tmp/nl-media-out.bin 2>/dev/null || echo 0)
[ "$msize" = "2048" ] && ok "media size matches (2048)" || bad "media size mismatch: $msize"

echo "=== 5. Delete song + media cleanup ==="
dcode=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/songs/$song_id" -H "x-admin-token: $token")
check "DELETE /api/songs/:id" "200" "$dcode"
gone=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$song_url")
check "media gone after delete" "404" "$gone"

echo "=== 6. Chat polling fallback ==="
ccode=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" -d '{"name":"NetlifyBot","text":"Sat Sri Akal from Netlify mode!"}')
check "POST /api/chat" "201" "$ccode"
hist=$(curl -s "$BASE/api/chat")
echo "$hist" | rg -q "NetlifyBot" && ok "chat history contains message" || bad "chat history missing msg: $hist"
badcode=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/chat" \
  -H "Content-Type: application/json" -d '{"name":"","text":""}')
check "POST /api/chat empty rejected" "400" "$badcode"

echo "=== 7. Listener message (public) ==="
lcode=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/messages" \
  -H "Content-Type: application/json" -d '{"name":"Netlify Listener","city":"Toronto","type":"greeting","message":"Hello from Netlify!"}')
[ "$lcode" = "200" ] || [ "$lcode" = "201" ] && ok "POST /api/messages ($lcode)" || bad "POST /api/messages -> $lcode"

echo "=== 8. Path traversal guard ==="
tcode=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/media/..%2F..%2Fetc%2Fpasswd")
[ "$tcode" = "404" ] || [ "$tcode" = "400" ] && ok "media traversal blocked ($tcode)" || bad "media traversal NOT blocked: $tcode"

echo ""
echo "======================================"
echo "RESULT: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ] && echo "ALL NETLIFY-MODE TESTS PASSED 🎉" || echo "SOME TESTS FAILED"
exit $FAIL
