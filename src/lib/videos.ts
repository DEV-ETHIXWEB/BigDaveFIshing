/**
 * The six films from the live site's Video Gallery.
 *
 * Titles, subtitles and thumbnail pairings are verbatim from that page's Slider
 * Revolution markup (recovered through the WordPress REST API, the rendered page builds
 * the slider in JS and shows none of it in its own source).
 *
 * `url` is null on every entry, and that is not an oversight. **The live site does not
 * link these videos anywhere.** Its slider layers are `image` and `text` only, no
 * `data-videoyoutube`, no iframe, no mp4, no anchor, no click action. The play buttons
 * are drawn into the thumbnails. Clicking a slide on the real site plays nothing.
 *
 * So the links have to come from the client (their YouTube channel, or the Angler West
 * TV and Addicted Fishing uploads these are featured on). Fill `url` in and the cards
 * below become real links automatically, the page already renders an <a> when a url is
 * present and a plain figure when it isn't. Nothing else needs changing.
 */
import type { ImageMetadata } from 'astro';

import battle from '../assets/photos/video-thumbs/big-dave-video-battle.jpg';
import winterSteelhead from '../assets/photos/video-thumbs/angler-westtv-winter-steelhead.jpg';
import alaskanCoho from '../assets/photos/video-thumbs/big-dave-alaskan-coho-fishing.jpg';
import fallChinook from '../assets/photos/video-thumbs/trask-wilson-river-fall-chinook.jpg';
import bobberDowns from '../assets/photos/video-thumbs/vide0-1.png';
import steelheadAwtv from '../assets/photos/video-thumbs/video2.png';

export interface Video {
  thumb: ImageMetadata;
  title: string;
  detail: string;
  /** TODO: awaiting real URLs from the client, see the note above. */
  url: string | null;
}

export const videos: Video[] = [
  {
    thumb: battle,
    title: '1 V 1 Steelhead FISHING Challenge!',
    detail: 'Winter Steelhead with Roland Martin & Big Dave',
    url: null,
  },
  {
    thumb: winterSteelhead,
    title: 'Oregon Coast Trophy Winter Steelhead Fishing',
    detail: 'Featured on Angler WestTV',
    url: null,
  },
  {
    thumb: alaskanCoho,
    title: 'Alaskan Coho Fishing with Big Dave and Max Manners',
    detail: 'Featured on Angler WestTV',
    url: null,
  },
  {
    thumb: fallChinook,
    title: 'Fall Chinook on the Trask & Wilson Rivers with Dave, Nick, and Jake',
    detail: 'Featured on Angler WestTV',
    url: null,
  },
  {
    thumb: bobberDowns,
    title: "EPIC Salmon Fishing BOBBER DOWNS! (Catch N' Cook)",
    detail: 'Featured on Addicted Fishing',
    url: null,
  },
  {
    thumb: steelheadAwtv,
    title: 'Winter Steelhead',
    detail: 'Featured on Angler West TV',
    url: null,
  },
];
