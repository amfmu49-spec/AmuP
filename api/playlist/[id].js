export default async function handler(req, res) {
  const { id, page } = req.query;
  const authHeader = req.headers.authorization || '';

  try {
    const targetUrl = `https://studio-api.prod.suno.com/api/playlist/${id}/?page=${page || 1}`;
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': authHeader,
        'Origin': 'https://suno.com',
        'Referer': 'https://suno.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("Vercel API error:", error);
    res.status(500).json({ error: error.message });
  }
}
