# AI GIF Maker

This extension adds two tools: `generate_gif` (text prompt in, animated GIF URL out) and `check_credits`.

- It needs `AIGIFMAKER_API_KEY` in the environment (create one at https://aigifmaker.ai/settings/apikeys). If a tool says no key is set, tell the user that, with the link.
- Each GIF costs 1 credit on the user's AI GIF Maker account. Confirm before making several GIFs in a row.
- A GIF usually takes about a minute; `generate_gif` waits and returns the URL.
- Only text to GIF is available: there is no frame count, size, photo-to-GIF or editing option.
