/**
 * Metadata Extractor Tests
 */

import { describe, it, expect } from 'vitest';
import { extractTitle, extractImage, extractStoreName, extractMetadata } from '../../src/utils/metadataExtractor';

describe('extractTitle', () => {
  it('should extract title from Open Graph meta tag', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="ASUS ROG Strix GTX 1080">
          <title>Buy ASUS ROG Strix GTX 1080 - PC Componentes</title>
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(extractTitle(doc)).toBe('ASUS ROG Strix GTX 1080');
  });

  it('should extract title from Twitter Card meta tag', () => {
    const html = `
      <html>
        <head>
          <meta name="twitter:title" content="Gaming Laptop 2024">
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(extractTitle(doc)).toBe('Gaming Laptop 2024');
  });

  it('should extract title from JSON-LD Product', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "Product",
              "name": "Mechanical Keyboard RGB"
            }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(extractTitle(doc)).toBe('Mechanical Keyboard RGB');
  });

  it('should extract title from H1 with >5 words', () => {
    const html = `
      <html>
        <body>
          <h1>This is a long product title with many words</h1>
        </body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(extractTitle(doc)).toBe('This is a long product title with many words');
  });

  it('should extract title from document.title', () => {
    const html = `
      <html>
        <head>
          <title>Product Name - Store</title>
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = extractTitle(doc);
    expect(title).toContain('Product Name');
  });

  it('should clean title by removing store name after separator', () => {
    const html = `
      <html>
        <head>
          <title>Product Name - Store Name</title>
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = extractTitle(doc);
    expect(title).toBe('Product Name');
  });

  it('should use fallback if no title found', () => {
    const html = '<html><body></body></html>';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const title = extractTitle(doc);
    expect(title).toContain('Product from');
  });
});

describe('extractImage', () => {
  it('should extract image from Open Graph meta tag', () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://example.com/product.jpg">
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(extractImage(doc)).toBe('https://example.com/product.jpg');
  });

  it('should extract image from JSON-LD Product', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "Product",
              "image": "https://example.com/image.jpg"
            }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(extractImage(doc)).toBe('https://example.com/image.jpg');
  });

  it('should extract image from JSON-LD with array', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "Product",
              "image": ["https://example.com/img1.jpg", "https://example.com/img2.jpg"]
            }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(extractImage(doc)).toBe('https://example.com/img1.jpg');
  });

  it('should return undefined if no image found', () => {
    const html = '<html><body></body></html>';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(extractImage(doc)).toBeUndefined();
  });

  it('should skip SVG images', () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://example.com/logo.svg">
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(extractImage(doc)).toBeUndefined();
  });
});

describe('extractStoreName', () => {
  it('should extract store name from JSON-LD Organization', () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "Organization",
              "name": "PC Componentes"
            }
          </script>
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(extractStoreName('https://www.pccomponentes.com', doc)).toBe('PC Componentes');
  });

  it('should extract store name from og:site_name', () => {
    const html = `
      <html>
        <head>
          <meta property="og:site_name" content="MediaMarkt">
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(extractStoreName('https://www.mediamarkt.es', doc)).toBe('MediaMarkt');
  });

  it('should clean domain name for known stores', () => {
    const html = '<html><body></body></html>';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    expect(extractStoreName('https://www.pccomponentes.com', doc)).toBe('PC Componentes');
    expect(extractStoreName('https://mediamarkt.es', doc)).toBe('MediaMarkt');
    expect(extractStoreName('https://www.amazon.es', doc)).toBe('Amazon');
  });

  it('should capitalize unknown domain names', () => {
    const html = '<html><body></body></html>';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    const storeName = extractStoreName('https://www.example-store.com', doc);
    expect(storeName).toContain('Example');
  });
});

describe('extractMetadata', () => {
  it('should extract all metadata at once', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Gaming Mouse RGB">
          <meta property="og:image" content="https://example.com/mouse.jpg">
          <meta property="og:site_name" content="Tech Store">
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const metadata = extractMetadata(doc, 'https://www.techstore.com/product/123');
    
    expect(metadata.title).toBe('Gaming Mouse RGB');
    expect(metadata.imageUrl).toBe('https://example.com/mouse.jpg');
    expect(metadata.storeName).toBe('Tech Store');
  });

  it('should handle missing optional fields', () => {
    const html = `
      <html>
        <head>
          <title>Product Name</title>
        </head>
        <body></body>
      </html>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const metadata = extractMetadata(doc, 'https://www.store.com');
    
    expect(metadata.title).toBe('Product Name');
    expect(metadata.imageUrl).toBeUndefined();
    expect(metadata.storeName).toBeTruthy();
  });
});
