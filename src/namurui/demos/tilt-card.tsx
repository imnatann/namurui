import { TiltCard } from "../tilt-card";

/**
 * The reference demo: a single Pro membership card that leans towards the pointer.
 * The card is a real credit-card shape – brand row, chip, number, member – so the tilt has
 * something physical to move.
 */
export default function Demo() {
  return (
    <div className="tc-demo">
      <style href="ui-demo-tilt-card" precedence="default">
        {css}
      </style>

      <TiltCard>
        <div className="tilt-card-demo__card">
          <div className="tilt-card-demo__top">
            <span className="tilt-card-demo__brand">
              {"affectUI "}
              <b>Pro</b>
            </span>
            <svg className="tilt-card-demo__wave" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8.5 7.5a7 7 0 0 1 0 9M12 5a10.5 10.5 0 0 1 0 14M15.5 2.5a14 14 0 0 1 0 19"></path>
            </svg>
          </div>

          <span className="tilt-card-demo__chip" aria-hidden="true"></span>

          <div className="tilt-card-demo__number">•••• •••• •••• 4821</div>

          <div className="tilt-card-demo__bottom">
            <div>
              <span className="tilt-card-demo__label">Member</span>
              <span className="tilt-card-demo__value">Alex Morgan</span>
            </div>
            <div>
              <span className="tilt-card-demo__label">Since</span>
              <span className="tilt-card-demo__value">10/26</span>
            </div>
          </div>
        </div>
      </TiltCard>
    </div>
  );
}

/* The reference demo's own card styles: a blue-to-violet card face with a gold chip and a
   light sweep in the top-right corner. Nothing here is component CSS – the tilt sheet lives in
   tilt-card.tsx. */
const css = `
.tc-demo{display:grid;place-items:center;width:100%}

.tilt-card-demo__card{
  position:relative;
  display:flex;
  flex-direction:column;
  width:340px;
  max-width:100%;
  aspect-ratio:1.586 / 1;
  padding:22px 24px;
  color:#fff;
  font-size:13px;
  line-height:1.42857em;
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(255, 255, 255, 0.22), transparent 55%),
    radial-gradient(90% 80% at 0% 100%, rgba(124, 77, 255, 0.55), transparent 60%),
    linear-gradient(135deg, #2f6bff 0%, #7c4dff 100%);
}

.tilt-card-demo__top{display:flex;justify-content:space-between;align-items:center}
.tilt-card-demo__brand{font-size:15px;font-weight:500;letter-spacing:-0.15px}
.tilt-card-demo__brand b{font-weight:600;opacity:0.75}
.tilt-card-demo__wave{width:20px;height:20px;flex:none;opacity:0.8;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round}

.tilt-card-demo__chip{
  position:relative;
  width:40px;
  height:30px;
  margin-top:auto;
  border-radius:6px;
  background:linear-gradient(135deg, #f3e2b3, #d9b86c 55%, #f1dca4);
  box-shadow:inset 0 0 0 1px rgba(120, 90, 30, 0.25);
}
/* The contact grid: a hairline down each third of the chip, in the same gold-brown ink. */
.tilt-card-demo__chip::after{
  content:"";
  position:absolute;
  inset:0;
  border-radius:inherit;
  background-image:
    linear-gradient(90deg, rgba(120, 88, 26, 0.3) 1px, transparent 1px),
    linear-gradient(180deg, rgba(120, 88, 26, 0.3) 1px, transparent 1px);
  background-size:33.3334% 100%, 100% 33.3334%;
}

.tilt-card-demo__number{margin-top:14px;font-size:17px;font-weight:500;letter-spacing:1.02px}

.tilt-card-demo__bottom{display:flex;gap:28px;margin-top:12px}
.tilt-card-demo__bottom > div{display:flex;flex-direction:column;gap:2px}
.tilt-card-demo__label{font-size:10px;font-weight:500;letter-spacing:0.8px;opacity:0.65;text-transform:uppercase}
.tilt-card-demo__value{font-size:13px;font-weight:500}
`;
