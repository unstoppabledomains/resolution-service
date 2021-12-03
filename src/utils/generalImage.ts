import { MetadataImageFontSize } from '../types/common';
import btoa from 'btoa';

export const BackgroundColor = '4C47F7';
export const FontFamily =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', Oxygen, Cantarell, sans-serif";

export function DefaultImageData(args: {
  label: string;
  tld: string;
  fontSize: MetadataImageFontSize;
}): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="250px" height="250px" viewBox="0 0 250 250" version="1.1" style="background-color:#4C47F7">
  <!-- Generator: Sketch 61 (89581) - https://sketch.com -->
  <title>unstoppabledomains_dot_crypto-</title>
  <desc>Created with Sketch.</desc>
  <g id="unstoppabledomains" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <rect fill="#${BackgroundColor}" x="0" y="0" width="100%" height="100%"/>
      <g id="Group-6" transform="translate(70.000000, 154.000000)">
          <g id="Group" transform="translate(5.000000, 43.000000)">
          <rect x="${args.tld === 'blockchain' ? -26 : 0}" y="0" width="${
    args.tld === 'blockchain' ? 150 : 100
  }" height="34" stroke="#2FE9FF" stroke-width="2.112px" rx="17"/>
              <text  dominant-baseline="middle" text-anchor="middle" font-size="16" font-weight="bold" fill="#FFFFFF" font-family="${FontFamily}"> <tspan x="19%" y="20">.${args.tld.toUpperCase()}</tspan></text>
          </g>
          <text text-anchor="middle" id="domain" font-family="${FontFamily}" font-size="${
    args.fontSize
  }" font-weight="bold" fill="#FFFFFF">
              <tspan x="22.5%" y="26">${
                args.label.length > 30
                  ? args.label.substr(0, 29).concat('...')
                  : args.label
              }</tspan>
          </text>
      </g>
      <g id="sign" transform="translate(56.000000, 19.000000)">
          <polygon id="Rectangle-Copy-3" fill="#2FE9FF" points="137.000268 2.12559903 137.000268 48.8887777 -2.72848394e-13 104.154352"/>
          <path d="M111.312718,-1.42108539e-14 L111.312718,80.7727631 C111.312718,104.251482 92.1448713,123.284744 68.5001341,123.284744 C44.855397,123.284744 25.6875503,104.251482 25.6875503,80.7727631 L25.6875503,46.7631786 L51.3751006,32.734225 L51.3751006,80.7727631 C51.3751006,88.9903146 58.0838469,95.6519563 66.3595049,95.6519563 C74.6351629,95.6519563 81.3439093,88.9903146 81.3439093,80.7727631 L81.3439093,16.3671125 L111.312718,-1.42108539e-14 Z" id="Path" fill="#FFFFFF"/>
      </g>
  </g>
</svg>`;
}
