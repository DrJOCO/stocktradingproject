const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
};

const UPSTREAM_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; SignalAnalyzer/1.0; +https://vercel.com)",
  Accept: "application/json,text/plain,*/*",
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return Response.json({ error: "Missing required symbol parameter." }, { status: 400, headers: JSON_HEADERS });
  }

  const upstreamParams = new URLSearchParams();
  ["range", "interval", "includePrePost", "events"].forEach((key) => {
    const value = searchParams.get(key);
    if (value != null && value !== "") upstreamParams.set(key, value);
  });

  const upstreamUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${upstreamParams.toString()}`;

  try {
    const upstream = await fetch(upstreamUrl, { headers: UPSTREAM_HEADERS });
    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: JSON_HEADERS,
    });
  } catch {
    return Response.json({ error: "Yahoo chart proxy failed." }, { status: 502, headers: JSON_HEADERS });
  }
}
