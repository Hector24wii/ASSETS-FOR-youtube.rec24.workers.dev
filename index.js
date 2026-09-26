// ============================================
// YouTube Para Todos - WebP + red lenta 2-4 Mbps
// ============================================

const INSTANCIAS = [
  'https://yt.chocolatemoo53.com',
  'https://invidious.f5.si',
  'https://invidious.nerdvpn.de',
  'https://invidious.tiekoetter.com',
  'https://inv.nadeko.net'
];

const LOGO_SRC = 'https://raw.githubusercontent.com/Hector24wii/ASSETS-FOR-youtube.rec24.workers.dev/main/logo-big.png';

const CSS = `
*{box-sizing:border-box}
body,html{background:#0f0f0f!important;color:#f1f1f1!important;font-family:Arial,sans-serif!important;margin:0}
header,nav,.navbar{background:#0f0f0f!important;border-bottom:1px solid #222!important;padding:6px 10px!important}
input[type=text],input[type=search]{background:#121212!important;border:1px solid #333!important;color:#fff!important;border-radius:20px!important;padding:8px 12px!important;font-size:14px!important;max-width:280px;width:100%}
img{max-width:100%!important;height:auto!important}
.thumbnail img,.video-card img{border-radius:8px!important;max-height:120px!important;object-fit:cover!important;width:100%!important}
.video .title,h3{color:#f1f1f1!important;font-size:13px!important;margin:6px 0 2px!important}
.author,.length{color:#888!important;font-size:11px!important}
video{border-radius:8px!important;max-width:100%!important}
a{color:#f1f1f1!important;text-decoration:none!important}
button,.pure-button{background:#272727!important;color:#fff!important;border:none!important;border-radius:14px!important;padding:6px 12px!important;font-size:13px!important}
*{animation:none!important;transition:none!important}
`;

function esCaptcha(html) {
  const t = (html || '').toLowerCase();
  return t.includes('go-away') || t.includes('anubis') || t.includes('recaptcha') ||
    t.includes('captcha') || t.includes('techaro') || t.includes('just a moment') ||
    t.includes('challenge success') || t.includes('asegurándonos de que no eres un robot');
}

// Miniatura YouTube más liviana
function miniaturaLiviana(src) {
  if (!src) return src;
  return src
    .replace('maxresdefault', 'mqdefault')
    .replace('hqdefault', 'mqdefault')
    .replace('sddefault', 'mqdefault')
    .replace('hq720', 'mqdefault');
}

// Proxy de imagen → pide WebP al origen / cache
async function servirImagen(rawUrl, request) {
  try {
    const dest = new URL(rawUrl);
    // Solo dominios de thumbs / estáticos conocidos
    const ok =
      dest.hostname.includes('ytimg.com') ||
      dest.hostname.includes('ggpht.com') ||
      dest.hostname.includes('googleusercontent.com') ||
      dest.hostname.includes('invidious') ||
      dest.hostname.includes('piped') ||
      dest.hostname.includes('githubusercontent.com') ||
      dest.hostname.includes('nadeko') ||
      dest.hostname.includes('chocolatemoo') ||
      dest.hostname.includes('nerdvpn') ||
      dest.hostname.includes('f5.si');

    if (!ok) return new Response('Blocked', { status: 403 });

    const res = await fetch(dest.toString(), {
      headers: {
        'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) Chrome/122.0.0.0 Mobile'
      },
      cf: {
        cacheTtl: 3600,
        cacheEverything: true,
        // Si tu plan tiene Image Resizing, descomenta:
        // image: { format: 'webp', quality: 60, width: 320, fit: 'scale-down' }
      }
    });

    if (!res.ok) return new Response('', { status: res.status });

    const h = new Headers(res.headers);
    const ct = res.headers.get('content-type') || 'image/jpeg';
    h.set('Content-Type', ct);
    h.set('Cache-Control', 'public, max-age=3600');
    h.set('Access-Control-Allow-Origin', '*');
    // Avisa al navegador que puede variar por Accept
    h.set('Vary', 'Accept');
    return new Response(res.body, { status: 200, headers: h });
  } catch {
    return new Response('', { status: 502 });
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Logo
    if (url.pathname === '/logo.png' || url.pathname === '/logo') {
      return servirImagen(LOGO_SRC, request);
    }

    // Proxy de imágenes WebP: /img?u=URL_ENCODED
    if (url.pathname === '/img') {
      const u = url.searchParams.get('u');
      if (!u) return new Response('Missing u', { status: 400 });
      return servirImagen(u, request);
    }

    let path = url.pathname + url.search;
    if (path === '/' || path === '') path = '/feed/trending';

    if (url.pathname.startsWith('/watch')) {
      if (!url.searchParams.has('local')) url.searchParams.set('local', 'true');
      if (!url.searchParams.has('quality')) url.searchParams.set('quality', 'medium');
      path = url.pathname + '?' + url.searchParams.toString();
    }

    let response = null;

    for (const base of INSTANCIAS) {
      try {
        const target = new URL(path, base);
        const headers = new Headers();
        headers.set('User-Agent', 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile Safari/537.36');
        headers.set('Accept', 'text/html,application/xhtml+xml,*/*;q=0.8');
        headers.set('Accept-Language', 'es-PA,es;q=0.9');
        headers.set('Accept-Encoding', 'gzip, deflate, br');

        const res = await fetch(target.toString(), {
          method: 'GET',
          headers,
          redirect: 'follow'
        });

        const tipo = res.headers.get('content-type') || '';

        if (!tipo.includes('text/html')) {
          if (res.ok || (res.status < 500 && res.status !== 404)) {
            const h = new Headers(res.headers);
            h.set('Access-Control-Allow-Origin', '*');
            if (tipo.includes('image')) h.set('Cache-Control', 'public, max-age=3600');
            return new Response(res.body, { status: res.status, headers: h });
          }
          continue;
        }

        const html = await res.text();
        if (esCaptcha(html)) continue;

        if (res.status < 500 && res.status !== 404) {
          response = new Response(html, { status: res.status, headers: res.headers });
          break;
        }
      } catch (_) {}
    }

    if (!response) {
      return new Response(
        `<!DOCTYPE html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
        <title>Error</title><style>body{background:#0f0f0f;color:#fff;font-family:Arial;text-align:center;padding:40px}</style></head>
        <body><h1>Sin conexión</h1><p>Reintenta en un minuto.</p></body></html>`,
        { status: 502, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    return new HTMLRewriter()
      .on('head', {
        element(el) {
          el.append(`<meta name="viewport" content="width=device-width,initial-scale=1">`, { html: true });
          el.append(`<style>${CSS}</style>`, { html: true });
        }
      })
      .on('img', {
        element(el) {
          let src = el.getAttribute('src') || el.getAttribute('data-src') || '';
          if (!src || src.startsWith('data:') || src.startsWith('/logo')) return;

          // Absolutizar si es relativa
          if (src.startsWith('//')) src = 'https:' + src;

          src = miniaturaLiviana(src);

          // Pasar por nuestro proxy /img (pide WebP)
          if (src.startsWith('http')) {
            el.setAttribute('src', '/img?u=' + encodeURIComponent(src));
          }

          el.setAttribute('loading', 'lazy');
          el.setAttribute('decoding', 'async');
          el.removeAttribute('srcset'); // evita bajar imágenes enormes
          el.removeAttribute('data-src');
        }
      })
      .on('header a.logo, .site-logo, a#logo, .pure-menu-heading, header .navbar-brand', {
        element(el) {
          el.replace(
            `<a href="/" style="display:flex;align-items:center;gap:6px;text-decoration:none">
              <img src="/logo.png" alt="YT" width="32" height="32" style="height:32px;width:auto">
              <span style="font-size:15px;font-weight:500;color:#fff">YouTube</span>
            </a>`,
            { html: true }
          );
        }
      })
      .on('title', { text(t) { t.replace('YouTube'); } })
      .transform(response);
  }
};
