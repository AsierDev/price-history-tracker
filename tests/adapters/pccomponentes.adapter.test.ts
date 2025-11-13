import { describe, it, expect } from 'vitest';
import { PcComponentesAdapter } from '@adapters/implementations/pccomponentes.adapter';

describe('PcComponentesAdapter', () => {
  const adapter = new PcComponentesAdapter();

  it('extracts price and title from DOM markup', async () => {
    const html = `
      <html>
        <body>
          <h1 id="pdp-title">Concentrador USB Vention</h1>
          <div id="pdp-price-section">
            <span id="pdp-price-current-container">
              <span id="pdp-price-current-integer">5<span id="pdp-price-current-decimals"><span class="decimalSeparator">,</span>99€</span></span>
            </span>
          </div>
          <div class="ficha-producto__gallery">
            <img src="https://example.com/hub.jpg" />
          </div>
        </body>
      </html>
    `;

    const result = await adapter.extractData(html);
    expect(result.title).toBe('Concentrador USB Vention');
    expect(result.price).toBeCloseTo(5.99, 2);
    expect(result.currency).toBe('EUR');
    expect(result.imageUrl).toBe('https://example.com/hub.jpg');
    expect(result.available).toBe(true);
  });

  it('falls back to JSON-LD when DOM price missing', async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [{
                "@type": "Product",
                "name": "Ratchet & Clank PS5",
                "image": "https://example.com/ps5.jpg",
                "offers": [{
                  "@type": "Offer",
                  "price": "69,99",
                  "priceCurrency": "EUR",
                  "availability": "https://schema.org/InStock"
                }]
              }]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = await adapter.extractData(html);
    expect(result.title).toBe('Ratchet & Clank PS5');
    expect(result.price).toBeCloseTo(69.99, 2);
    expect(result.currency).toBe('EUR');
    expect(result.available).toBe(true);
  });
});
