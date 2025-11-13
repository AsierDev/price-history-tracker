import { describe, it, expect } from 'vitest';
import { ElCorteInglesAdapter } from '@adapters/implementations/elcorteingles.adapter';

describe('ElCorteInglesAdapter', () => {
  const adapter = new ElCorteInglesAdapter();

  it('parses JSON-LD data with comma decimals', async () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [{
                "@type": "Product",
                "name": "Motorola Edge 60 Fusion",
                "image": "https://example.com/moto.jpg",
                "offers": {
                  "@type": "Offer",
                  "price": "249,90",
                  "priceCurrency": "EUR",
                  "availability": "https://schema.org/InStock"
                }
              }]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const result = await adapter.extractData(html);
    expect(result.title).toBe('Motorola Edge 60 Fusion');
    expect(result.price).toBeCloseTo(249.9, 2);
    expect(result.currency).toBe('EUR');
    expect(result.imageUrl).toBe('https://example.com/moto.jpg');
    expect(result.available).toBe(true);
  });

  it('uses DOM selectors when JSON-LD missing', async () => {
    const html = `
      <html>
        <body>
          <section class="price">
            <div class="price--main">
              <div class="price-container">
                <span class="price-sale">129,90 €</span>
                <span class="price-discount">20%</span>
              </div>
            </div>
          </section>
          <h1 class="product-title">Zapatillas Callaghan</h1>
          <div class="gallery__image">
            <img src="https://example.com/shoe.jpg" />
          </div>
        </body>
      </html>
    `;

    const result = await adapter.extractData(html);
    expect(result.title).toBe('Zapatillas Callaghan');
    expect(result.price).toBeCloseTo(129.9, 2);
    expect(result.currency).toBe('EUR');
    expect(result.imageUrl).toBe('https://example.com/shoe.jpg');
  });
});
