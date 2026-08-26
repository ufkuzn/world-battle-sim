import urllib.request
import io
try:
    from PIL import Image
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'Pillow'])
    from PIL import Image

# Download a world map mask (black and white, equirectangular)
url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/BlankMap-World-Equirectangular.svg/600px-BlankMap-World-Equirectangular.svg.png'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        img_data = response.read()
    img = Image.open(io.BytesIO(img_data)).convert('RGBA')
    img = img.resize((300, 150), Image.Resampling.NEAREST)

    lines = []
    for y in range(150):
        line = ''
        for x in range(300):
            r, g, b, a = img.getpixel((x, y))
            # Wikipedia blank maps: Land is grey (#cccccc) or white, Ocean is transparent or white.
            # Usually land is grey. Let's say if it's opaque and not pure white, it's land.
            if a > 100 and (r < 240 or g < 240 or b < 240):
                line += 'L'
            else:
                line += 'W'
        lines.append(line)

    with open('src/earth_data.ts', 'w') as f:
        f.write('export const EARTH_ASCII = [\n')
        for line in lines:
            f.write(f'  "{line}",\n')
        f.write('];\n')
    print('Map generated successfully.')
except Exception as e:
    print('Error:', e)
