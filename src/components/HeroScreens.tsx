/**
 * What the product makes, on the page that sells it.
 *
 * The hero was copy on a gradient: nothing on the first screen showed a site built with
 * this. This is the real opening screen of a template in the library, the same still the
 * gallery serves, so the picture cannot drift from what a visitor gets when they open
 * it. No browser chrome and nothing stacked behind it: the screen is the object, tilted
 * a couple of degrees so it sits in the page rather than on it.
 */
export default function HeroScreens() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      <figure className="relative -rotate-[2deg] overflow-hidden rounded-2xl border border-white/15 shadow-[0_50px_100px_-40px_rgba(0,0,0,0.95)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/template-previews/tripvault.jpg"
          alt="The opening screen of TripVault, one of the templates in the library"
          width={800}
          height={500}
          fetchPriority="high"
          className="block aspect-[16/10] w-full object-cover"
        />
      </figure>
    </div>
  );
}
