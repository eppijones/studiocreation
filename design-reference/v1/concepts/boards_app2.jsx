/* ============================================================
   Concept Boards v2 — canvas assembly (digital-native round)
   ============================================================ */

function BoardsApp2() {
  return (
    <DesignCanvas>
      <DCSection id="dir-d" title="Direction D — Lumen" subtitle="Light as material · frosted glass over a luminous field · blur is hierarchy">
        <DCArtboard id="lm-hero" label="Hero — Home (Dashboard)" width={1440} height={900}>
          <LumenHero />
        </DCArtboard>
        <DCArtboard id="lm-spec" label="Type & Color Specimen" width={1440} height={640}>
          <LumenSpecimen />
        </DCArtboard>
      </DCSection>

      <DCSection id="dir-e" title="Direction E — Manifold" subtitle="The studio is a space, not a page · jobs are bodies in a navigable volume · the nav is a minimap">
        <DCArtboard id="mf-hero" label="Hero — The Volume (Queue sector)" width={1440} height={900}>
          <ManifoldHero />
        </DCArtboard>
        <DCArtboard id="mf-spec" label="Type & Color Specimen" width={1440} height={640}>
          <ManifoldSpecimen />
        </DCArtboard>
      </DCSection>

      <DCSection id="dir-f" title="Direction F — Soft Body" subtitle="A tool with a body · gel volumes with mass & viscosity · money has physics">
        <DCArtboard id="sb-hero" label="Hero — Today (Dashboard)" width={1440} height={900}>
          <SoftBodyHero />
        </DCArtboard>
        <DCArtboard id="sb-spec" label="Type & Color Specimen" width={1440} height={640}>
          <SoftBodySpecimen />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<BoardsApp2 />);
