import type { NinePatchGuides } from '../domain/ninePatch';
import type { Size } from '../preview/layout';
import { iosInsetGeometry } from '../preview/ninePatchStyle';
import { NineSliceImage } from './NineSliceImage';

export function IosBubbleArtwork({ image, guides, sourceSize, sourceScale }: {
  image: string;
  guides: NinePatchGuides;
  sourceSize: Size;
  sourceScale: number;
}) {
  const geometry = iosInsetGeometry(guides, sourceSize, sourceScale);

  return <NineSliceImage
    image={image}
    guides={geometry.guides}
    sourceSize={sourceSize}
    sourceScale={geometry.scale}
    renderer="ios-inset-nine-slice"
  />;
}
