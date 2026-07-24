export const posterStyles = `
@font-face {
  font-family: "Poppins";
  src: url("/fonts/poppins-regular.woff2") format("woff2");
  font-weight: 400;
}
@font-face {
  font-family: "Poppins";
  src: url("/fonts/poppins-bold.woff2") format("woff2");
  font-weight: 700;
}
@font-face {
  font-family: "Poppins";
  src: url("/fonts/poppins-extrabold.woff2") format("woff2");
  font-weight: 800;
}
@page {
  size: 250mm 760mm;
  margin: 0;
}
* { box-sizing: border-box; }
body { margin: 0; background: #fff; font-family: "Poppins", sans-serif; }
.race-poster {
  width: 250mm;
  height: 760mm;
  position: relative;
  overflow: hidden;
  background: #fff;
  color: #111;
  font-family: "Poppins", sans-serif;
  page-break-after: always;
}
.poster-header {
  position: absolute;
  top: 30mm;
  left: 0;
  width: 100%;
  text-align: center;
  color: #121315;
}
.poster-date {
  font-size: 14.25pt;
  line-height: 1;
  font-weight: 800;
  color: #121315;
}
.poster-venue {
  margin-top: 3mm;
  font-size: 25.5pt;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0;
  color: #121315;
}
.poster-race-line {
  margin-top: 8mm;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0;
  font-size: 25.5pt;
  line-height: 1;
  font-weight: 800;
  color: #121315;
}
.poster-bracket {
  font-size: 39pt;
  line-height: .8;
  padding: 0 1mm;
}
.poster-runners {
  position: absolute;
  left: 12mm;
  right: 10mm;
}
.poster-runner {
  position: absolute;
  left: 0;
  right: 0;
}
.runner-main {
  display: grid;
  grid-template-columns: 18mm minmax(0, 1fr);
  align-items: baseline;
  height: 23mm;
  overflow: visible;
}
.runner-number {
  color: #ff0000;
  font-weight: 800;
  line-height: .9;
}
.runner-name {
  color: #09229d;
  font-weight: 800;
  line-height: .92;
  white-space: nowrap;
  letter-spacing: 0;
}
.runner-detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 78mm;
  align-items: start;
  padding-left: 1mm;
  font-weight: 800;
  line-height: 1.05;
}
.runner-trainer {
  color: #8e0808;
  white-space: nowrap;
}
.runner-jockey {
  color: #246c08;
  text-align: right;
  white-space: nowrap;
}
.runner-draw {
  color: #0b5bac;
}
.poster-footer {
  position: absolute;
  right: 20mm;
  bottom: 28mm;
  text-align: right;
  font-size: 18pt;
  line-height: 1.25;
  font-weight: 400;
  color: #1976D2;
}
.poster-footer strong {
  display: block;
  font-weight: 400;
  color: #C218A7;
}
`;
