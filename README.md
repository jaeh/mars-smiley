# mars smiley

there is a smiley on mars.

this repository downloads both the satelite image tiles as well as the height heatmap tiles from cartodb.

### usage:
```bash
git clone https://github.com:jaeh/mars-smiley
cd mars-smiley
npm install

# remove images to force regeneration
rm color/merged-* height/merged*

# run image task, will download images that are missing and merge them
./index.js
```
