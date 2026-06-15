/* ============================================================
   Concept Boards — canvas assembly
   ============================================================ */

function BoardsApp() {
  return (
    <DesignCanvas>
      <DCSection id="dir-a" title="Direction A — The Counting House" subtitle="Every generation is a transaction · banking hall × financial broadsheet">
        <DCArtboard id="ch-hero" label="Hero — Front Page (Dashboard)" width={1440} height={900}>
          <CountingHouseHero />
        </DCArtboard>
        <DCArtboard id="ch-spec" label="Type & Color Specimen" width={1440} height={640}>
          <CountingHouseSpecimen />
        </DCArtboard>
      </DCSection>

      <DCSection id="dir-b" title="Direction B — Terminal One" subtitle="Every job is a departure · split-flap boards, fares & gates at signage scale">
        <DCArtboard id="t1-hero" label="Hero — Concourse (Dashboard)" width={1440} height={900}>
          <TerminalHero />
        </DCArtboard>
        <DCArtboard id="t1-spec" label="Type & Color Specimen" width={1440} height={640}>
          <TerminalSpecimen />
        </DCArtboard>
      </DCSection>

      <DCSection id="dir-c" title="Direction C — The Lightbench" subtitle="Every frame earns its mark · film-lab lightbox, grease pencil & chemistry">
        <DCArtboard id="lb-hero" label="Hero — Bench (Dashboard)" width={1440} height={900}>
          <LightbenchHero />
        </DCArtboard>
        <DCArtboard id="lb-spec" label="Type & Color Specimen" width={1440} height={640}>
          <LightbenchSpecimen />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<BoardsApp />);
