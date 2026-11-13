# Steam Deck

`steam-deck.json` is Valve's official Steam Deck shell, simplified from 132,100 to about
9,000 triangles with this package's CLI:

```bash
npx dither-model steamdeck_stl_20220202.stl -o steam-deck.json --triangles 9000 \
  --credit "Steam Deck CAD by Valve (https://gitlab.steamos.cloud/SteamHardware/SteamDeck), simplified" \
  --license "CC BY-NC-SA 4.0"
```

The screen is drawn dark with this box (millimetres, the file's units). It's the glass as
measured in the CAD file: 174 × 107 mm, set 1 mm into the front:

```html
<dither-model src="steam-deck.json" dark="-87 -53.5 -1.5 87 53.5 0.5"></dither-model>
```

## License

This model is **not** under the MIT license of the rest of the repository.

Original: [Steam Deck CAD](https://gitlab.steamos.cloud/SteamHardware/SteamDeck) by Valve,
licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).
Changes: converted from STL and simplified (fewer triangles, positions rounded).
This simplified version is shared under the same license, CC BY-NC-SA 4.0.

You can use it on non-commercial pages as long as you credit Valve and keep the license.
It isn't published to npm with the package.
