import sharp from "sharp";
import { readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// iOS device splash screen sizes (portrait orientation)
const splashSizes = [
  // iPhone SE, 8
  {
    width: 750,
    height: 1334,
    name: "apple-splash-750-1334",
    media:
      "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)",
  },
  // iPhone 8 Plus
  {
    width: 1242,
    height: 2208,
    name: "apple-splash-1242-2208",
    media:
      "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)",
  },
  // iPhone X, XS, 11 Pro
  {
    width: 1125,
    height: 2436,
    name: "apple-splash-1125-2436",
    media:
      "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)",
  },
  // iPhone XR, 11
  {
    width: 828,
    height: 1792,
    name: "apple-splash-828-1792",
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)",
  },
  // iPhone XS Max, 11 Pro Max
  {
    width: 1242,
    height: 2688,
    name: "apple-splash-1242-2688",
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)",
  },
  // iPhone 12 mini, 13 mini
  {
    width: 1080,
    height: 2340,
    name: "apple-splash-1080-2340",
    media:
      "(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3)",
  },
  // iPhone 12, 12 Pro, 13, 13 Pro, 14
  {
    width: 1170,
    height: 2532,
    name: "apple-splash-1170-2532",
    media:
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
  },
  // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
  {
    width: 1284,
    height: 2778,
    name: "apple-splash-1284-2778",
    media:
      "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
  },
  // iPhone 14 Pro
  {
    width: 1179,
    height: 2556,
    name: "apple-splash-1179-2556",
    media:
      "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
  },
  // iPhone 14 Pro Max
  {
    width: 1290,
    height: 2796,
    name: "apple-splash-1290-2796",
    media:
      "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
  },
  // iPhone 15, 15 Pro
  {
    width: 1179,
    height: 2556,
    name: "apple-splash-1179-2556-15",
    media:
      "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)",
  },
  // iPhone 15 Plus, 15 Pro Max
  {
    width: 1290,
    height: 2796,
    name: "apple-splash-1290-2796-15",
    media:
      "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
  },
  // iPad (10.2")
  {
    width: 1620,
    height: 2160,
    name: "apple-splash-1620-2160",
    media:
      "(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2)",
  },
  // iPad Pro (11")
  {
    width: 1668,
    height: 2388,
    name: "apple-splash-1668-2388",
    media:
      "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)",
  },
  // iPad Pro (12.9")
  {
    width: 2048,
    height: 2732,
    name: "apple-splash-2048-2732",
    media:
      "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)",
  },
];

const backgroundColor = "#ffffff";
const outputDir = join(process.cwd(), "public", "splash");

// Create output directory if it doesn't exist
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

async function generateSplashScreens() {
  console.log("Generating iOS splash screens...");

  // Try to load the logo - first try PNG from base64 in SVG, then try SVG directly
  let logoBuffer: Buffer | null = null;

  try {
    // Extract base64 PNG from SVG
    const svgPath = join(process.cwd(), "public", "hoador-logo.svg");
    const svgContent = readFileSync(svgPath, "utf-8");
    const base64Match = svgContent.match(/data:image\/png;base64,([^"]+)/);

    if (base64Match) {
      logoBuffer = Buffer.from(base64Match[1], "base64");
      console.log("Loaded logo from embedded PNG");
    } else {
      // Try to use the SVG directly
      logoBuffer = readFileSync(svgPath);
      console.log("Using SVG logo directly");
    }
  } catch (error) {
    console.warn("Could not load logo, generating splash screens without logo");
  }

  for (const size of splashSizes) {
    try {
      // Create white background
      let image = sharp({
        create: {
          width: size.width,
          height: size.height,
          channels: 3,
          background: backgroundColor,
        },
      });

      // If we have a logo, composite it in the center
      if (logoBuffer) {
        const logo = sharp(logoBuffer);
        const logoMetadata = await logo.metadata();

        if (logoMetadata.width && logoMetadata.height) {
          // Calculate logo size (max 40% of screen width, maintaining aspect ratio)
          const maxLogoWidth = size.width * 0.4;
          const logoAspectRatio = logoMetadata.width / logoMetadata.height;
          const logoWidth = Math.min(maxLogoWidth, logoMetadata.width);
          const logoHeight = logoWidth / logoAspectRatio;

          // Resize logo
          const resizedLogo = await logo
            .resize(Math.round(logoWidth), Math.round(logoHeight), {
              fit: "inside",
              withoutEnlargement: true,
            })
            .toBuffer();

          // Composite logo in center
          image = image.composite([
            {
              input: resizedLogo,
              top: Math.round((size.height - logoHeight) / 2),
              left: Math.round((size.width - logoWidth) / 2),
            },
          ]);
        }
      }

      // Save the image
      const outputPath = join(outputDir, `${size.name}.png`);
      await image.png().toFile(outputPath);
      console.log(
        `✓ Generated ${size.name}.png (${size.width}x${size.height})`,
      );
    } catch (error) {
      console.error(`✗ Failed to generate ${size.name}:`, error);
    }
  }

  console.log(`\n✓ All splash screens generated in ${outputDir}`);
}

generateSplashScreens().catch(console.error);
