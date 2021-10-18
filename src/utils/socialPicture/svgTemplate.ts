interface SvgFields {
  background_image: string;
  domain: string;
  fontSize: number;
  mimeType?: string;
}

const FontFamily =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', Oxygen, Cantarell, sans-serif";

export default function createSocialPictureSvg({
  background_image,
  domain,
  fontSize,
  mimeType,
}: SvgFields): string {
  return `<svg width="300" height="300" viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
          <pattern id="backImg" patternUnits="userSpaceOnUse" x="0" y="0" width="300" height="300">
            <image href="data:${mimeType};base64,${background_image}" width="300" height="300" />
          </pattern>
          <filter id="shadowy">
            <feDiffuseLighting in="SourceGraphic" result="light"
                lighting-color="white">
              <feDistantLight azimuth="240" elevation="40"/>
            </feDiffuseLighting>
            <feComposite in="SourceGraphic" in2="light"
                        operator="arithmetic" k1="1" k2="0" k3="0" k4="0"/>
          </filter>
    </defs>
    <rect width="300" height="300" fill="url(#backImg)" filter="url(#shadowy)"/>

    <g transform="translate(20,25)">
      <g transform="scale(1.4)">
        <path xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" d="M38.0294 3.44824V16.4532L0 31.8226L38.0294 3.44824Z" fill="#2FE9FF" />
        <path xmlns="http://www.w3.org/2000/svg" fill-rule="evenodd" clip-rule="evenodd" d="M30.8988 2.85718V25.3202C30.8988 31.8497 25.578 37.1429 19.0146 37.1429C12.4511 37.1429 7.13037 31.8497 7.13037 25.3202V15.8621L14.2609 11.9606V25.3202C14.2609 27.6055 16.1231 29.4582 18.4204 29.4582C20.7176 29.4582 22.5798 27.6055 22.5798 25.3202V7.4089L30.8988 2.85718Z" fill="#4C47F7"/>
      </g>
      <g transform="scale(0.7) translate(45, 55)">
        <path d="M13.474 2.80108C14.2729 1.85822 15.7271 1.85822 16.526 2.80108L17.4886 3.9373C17.9785 4.51548 18.753 4.76715 19.4892 4.58733L20.9358 4.23394C22.1363 3.94069 23.3128 4.79547 23.4049 6.0278L23.5158 7.51300C23.5723 8.26854 24.051 8.92742 24.7522 9.21463L26.1303 9.77906C27.2739 10.2474 27.7233 11.6305 27.0734 12.6816L26.2903 13.9482C25.8918 14.5928 25.8918 15.4072 26.2903 16.0518L27.0734 17.3184C27.7233 18.3695 27.2739 19.7526 26.1303 20.2209L24.7522 20.7854C24.051 21.0726 23.5723 21.7315 23.5158 22.4871L23.4049 23.9722C23.3128 25.2045 22.1363 26.0593 20.9358 25.7661L19.4892 25.4127C18.753 25.2328 17.9785 25.4845 17.4886 26.0627L16.526 27.1989C15.7271 28.1418 14.2729 28.1418 13.474 27.1989L12.5114 26.0627C12.0215 25.4845 11.247 25.2328 10.5108 25.4127L9.06418 25.7661C7.86371 26.0593 6.6872 25.2045 6.59513 23.9722L6.48419 22.4871C6.42773 21.7315 5.94903 21.0726 5.24777 20.7854L3.86969 20.2209C2.72612 19.7526 2.27673 18.3695 2.9266 17.3184L3.70973 16.0518C4.10824 15.4072 4.10824 14.5928 3.70973 13.9482L2.9266 12.6816C2.27673 11.6305 2.72612 10.2474 3.86969 9.77906L5.24777 9.21463C5.94903 8.92742 6.42773 8.26854 6.48419 7.51300L6.59513 6.0278C6.6872 4.79547 7.86371 3.94069 9.06418 4.23394L10.5108 4.58733C11.247 4.76715 12.0215 4.51548 12.5114 3.9373L13.474 2.80108Z" fill="#15B2E5"/>
        <path d="M13.5 17.625L10.875 15L10 15.875L13.5 19.375L21 11.875L20.125 11L13.5 17.625Z" fill="white" stroke="white"/>
      </g>
    </g>
    <text
      x="32.5"
      y="260"
      font-size="${fontSize}px"
      font-weight="bold"
      fill="#FFFFFF"
      font-family="${FontFamily}"
      >
        ${domain}
    </text>
  </svg>`;
}
