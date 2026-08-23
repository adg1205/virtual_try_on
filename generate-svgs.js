const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'public', 'images', 'frames');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

// Helper to wrap SVG content
const svgWrap = (content, color = '#333') => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 200" width="500" height="200">
  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.3"/>
    </filter>
  </defs>
  <g filter="url(#shadow)" stroke="${color}" fill="rgba(0,0,0,0.15)">
    ${content}
  </g>
</svg>`;

const styles = {
    'aviator_front.svg': {
        color: '#d4af37', // Gold
        content: `
            <!-- Bridge -->
            <path d="M 230 70 Q 250 60 270 70" fill="none" stroke-width="6"/>
            <!-- Top bar -->
            <path d="M 210 55 Q 250 45 290 55" fill="none" stroke-width="4"/>
            <!-- Lenses -->
            <path d="M 230 70 C 230 40 180 40 130 50 C 90 60 90 120 110 160 C 130 190 200 170 230 110 Z" stroke-width="6"/>
            <path d="M 270 70 C 270 40 320 40 370 50 C 410 60 410 120 390 160 C 370 190 300 170 270 110 Z" stroke-width="6"/>
        `
    },
    'wayfarer_front.svg': {
        color: '#222', // Black
        content: `
            <!-- Bridge -->
            <path d="M 230 80 Q 250 70 270 80" fill="none" stroke-width="8"/>
            <!-- Lenses -->
            <path d="M 230 80 L 235 120 Q 230 150 190 150 L 140 150 Q 110 140 110 110 L 100 60 Q 110 50 150 50 L 200 55 Q 230 60 230 80 Z" stroke-width="12" stroke-linejoin="round"/>
            <path d="M 270 80 L 265 120 Q 270 150 310 150 L 360 150 Q 390 140 390 110 L 400 60 Q 390 50 350 50 L 300 55 Q 270 60 270 80 Z" stroke-width="12" stroke-linejoin="round"/>
            <!-- End pieces -->
            <path d="M 110 60 L 90 55 L 95 70 Z" fill="#222"/>
            <path d="M 390 60 L 410 55 L 405 70 Z" fill="#222"/>
        `
    },
    'round_front.svg': {
        color: '#c0c0c0', // Silver
        content: `
            <!-- Bridge -->
            <path d="M 220 90 Q 250 70 280 90" fill="none" stroke-width="4"/>
            <!-- Lenses -->
            <circle cx="160" cy="100" r="60" stroke-width="6"/>
            <circle cx="340" cy="100" r="60" stroke-width="6"/>
            <!-- End pieces -->
            <line x1="100" y1="90" x2="80" y2="90" stroke-width="4"/>
            <line x1="400" y1="90" x2="420" y2="90" stroke-width="4"/>
        `
    },
    'clubmaster_front.svg': {
        color: '#4a3b32', // Tortoise dark
        content: `
            <!-- Bridge -->
            <path d="M 230 90 Q 250 80 270 90" fill="none" stroke-width="5" stroke="#d4af37"/>
            <!-- Bottom Wire -->
            <path d="M 230 90 Q 230 160 170 150 Q 110 140 115 100" fill="none" stroke-width="3" stroke="#d4af37"/>
            <path d="M 270 90 Q 270 160 330 150 Q 390 140 385 100" fill="none" stroke-width="3" stroke="#d4af37"/>
            <!-- Top Acetate Brow -->
            <path d="M 230 90 L 235 70 Q 180 50 110 65 L 115 100 Q 180 80 230 90 Z" fill="#4a3b32" stroke-width="2"/>
            <path d="M 270 90 L 265 70 Q 320 50 390 65 L 385 100 Q 320 80 270 90 Z" fill="#4a3b32" stroke-width="2"/>
            <!-- Accents -->
            <circle cx="130" cy="75" r="3" fill="#d4af37" stroke="none"/>
            <circle cx="370" cy="75" r="3" fill="#d4af37" stroke="none"/>
        `
    },
    'titan_front.svg': {
        color: '#555', // Gunmetal
        content: `
            <!-- Bridge -->
            <line x1="225" y1="85" x2="275" y2="85" stroke-width="2"/>
            <!-- Lenses (Rectangular thin) -->
            <rect x="110" y="70" width="115" height="55" rx="8" stroke-width="3"/>
            <rect x="275" y="70" width="115" height="55" rx="8" stroke-width="3"/>
        `
    },
    'cateye_front.svg': {
        color: '#b76e79', // Rose gold
        content: `
            <!-- Bridge -->
            <path d="M 230 90 Q 250 80 270 90" fill="none" stroke-width="4"/>
            <!-- Lenses -->
            <path d="M 230 90 Q 210 150 160 150 Q 110 150 100 110 Q 90 60 140 50 Q 220 50 230 90 Z" stroke-width="6"/>
            <path d="M 270 90 Q 290 150 340 150 Q 390 150 400 110 Q 410 60 360 50 Q 280 50 270 90 Z" stroke-width="6"/>
            <!-- Cat eye flicks -->
            <path d="M 120 55 Q 90 30 70 40 Q 90 60 100 90 Z" fill="#b76e79" stroke="none"/>
            <path d="M 380 55 Q 410 30 430 40 Q 410 60 400 90 Z" fill="#b76e79" stroke="none"/>
        `
    },
    'geometric_front.svg': {
        color: '#111', // Black
        content: `
            <!-- Bridge -->
            <line x1="225" y1="80" x2="275" y2="80" stroke-width="6"/>
            <!-- Lenses (Hexagonal) -->
            <polygon points="170,50 225,80 210,130 170,150 120,130 110,80" stroke-width="8" stroke-linejoin="round"/>
            <polygon points="330,50 275,80 290,130 330,150 380,130 390,80" stroke-width="8" stroke-linejoin="round"/>
        `
    },
    'oval_front.svg': {
        color: '#8b5a2b', // Honey Brown
        content: `
            <!-- Bridge -->
            <path d="M 225 90 Q 250 80 275 90" fill="none" stroke-width="6"/>
            <!-- Lenses -->
            <ellipse cx="165" cy="100" rx="60" ry="40" stroke-width="8"/>
            <ellipse cx="335" cy="100" rx="60" ry="40" stroke-width="8"/>
        `
    },
    'sport_front.svg': {
        color: '#333', // Matte black
        content: `
            <!-- Lenses (Wrap around single shield style) -->
            <path d="M 250 70 Q 350 60 420 90 Q 400 140 320 140 Q 250 130 250 110 Q 250 130 180 140 Q 100 140 80 90 Q 150 60 250 70 Z" stroke-width="10" stroke-linejoin="round"/>
            <!-- Top rim -->
            <path d="M 80 90 Q 150 50 250 60 Q 350 50 420 90" fill="none" stroke-width="14" stroke-linecap="round"/>
        `
    },
    'square_front.svg': {
        color: '#666', // Clear/Grey
        content: `
            <!-- Bridge -->
            <path d="M 230 80 Q 250 75 270 80" fill="none" stroke-width="4"/>
            <!-- Lenses -->
            <rect x="110" y="60" width="120" height="90" rx="15" stroke-width="6"/>
            <rect x="270" y="60" width="120" height="90" rx="15" stroke-width="6"/>
        `
    }
};

for (const [filename, data] of Object.entries(styles)) {
    const svgStr = svgWrap(data.content, data.color);
    fs.writeFileSync(path.join(outDir, filename), svgStr);
    console.log(`Generated ${filename}`);
}

console.log('All SVGs generated successfully.');
