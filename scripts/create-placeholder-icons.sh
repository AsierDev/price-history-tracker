#!/bin/bash
# Create placeholder icon files for the extension
# These are simple SVG files that will be converted to PNG by Chrome

ICON_DIR="src/popup/icons"
mkdir -p "$ICON_DIR"

# Create SVG template
create_icon() {
  local size=$1
  local file="$ICON_DIR/icon${size}.svg"
  
  cat > "$file" << 'EOF'
<svg width="SIZE" height="SIZE" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="SIZE" height="SIZE" fill="url(#grad)" rx="RADIUS"/>
  <text x="50%" y="50%" font-size="FONTSIZE" text-anchor="middle" dominant-baseline="central" fill="white" font-family="Arial, sans-serif">💰</text>
</svg>
EOF

  # Replace SIZE placeholder
  sed -i.bak "s/SIZE/$size/g" "$file"
  
  # Calculate radius and font size
  local radius=$((size / 8))
  local fontsize=$((size / 2))
  sed -i.bak "s/RADIUS/$radius/g" "$file"
  sed -i.bak "s/FONTSIZE/$fontsize/g" "$file"
  
  # Remove backup files
  rm -f "$file.bak"
  
  echo "✓ Created $file"
}

# Create icons for all sizes
create_icon 16
create_icon 48
create_icon 128

echo ""
echo "✅ Placeholder icons created successfully!"
echo "📝 Note: Chrome will render these SVG files. For production, replace with proper PNG icons."
