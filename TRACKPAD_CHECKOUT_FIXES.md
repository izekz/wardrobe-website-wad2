# Style Feed trackpad + checkout corrections

## Style Feed
- Removed the wheel-event gesture lock that could leave a Mac trackpad unresponsive after one scroll.
- Regular mouse/trackpad wheel movements now scroll natively and CSS snap settles on a video.
- The first card does not wrap upward.
- Scrolling down again after coming to rest on the last card wraps to the first video.
- Keyboard arrows and mobile swipes continue to work.
- No changes to videos, sponsored ordering, likes, product cards or video dimensions.

## Customer checkout
- Removed the material input entirely: customers choose only listed size and colour.
- Server does not accept user-supplied material. Until business listings offer a verified material attribute, purchased wardrobe items use the neutral internal value `Not specified`.
- The receipt hides material when no material was specified by the business.
- No changes to business listing forms.

## Checks run
- 16 focused node tests passed (Style Feed, video progress and checkout field checks).
- Modified Vue script sections and controller files passed syntax checks.
- Headless Chromium tested native scrolling through and back on desktop and mobile viewport simulations, including looping from last card.
- Full application build and live database checkout have not been run in this environment.
