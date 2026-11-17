import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Blocks, Building2, RotateCcw, Users } from "lucide-react";
import { apiFetch } from "./apiClient.js";

const COMMUNITY_POSITIONS = {
  greenfield: [-5.2, -1.5],
  metrocore: [0, -2.6],
  novadistrict: [5.2, 1.8]
};

const COMMUNITY_COLORS = {
  emerald: "#25834a",
  cyan: "#cb3943",
  violet: "#d94f8c"
};

const FACILITY_HEIGHTS = [0.8, 1.3, 1.05, 1.6, 0.95, 1.2];

function CameraControls({ resetToken }) {
  const { camera, gl } = useThree();

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 11;
    controls.maxDistance = 34;
    controls.maxPolarAngle = Math.PI / 2.05;
    camera.position.set(9, 13, 14);
    controls.target.set(0, 0.2, 0);
    controls.update();
    return () => controls.dispose();
  }, [camera, gl, resetToken]);

  return null;
}

function Road({ from, to }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  return (
    <mesh
      position={[(from[0] + to[0]) / 2, -0.035, (from[1] + to[1]) / 2]}
      rotation={[0, Math.atan2(dx, dz), 0]}
    >
      <boxGeometry args={[0.42, 0.035, Math.hypot(dx, dz)]} />
      <meshStandardMaterial color="#cbd8ce" roughness={0.88} />
    </mesh>
  );
}

function FacilityBuilding({ facility, index, community, onSelect }) {
  const height = FACILITY_HEIGHTS[index % FACILITY_HEIGHTS.length];
  const color = COMMUNITY_COLORS[community.accent] || COMMUNITY_COLORS.violet;
  const row = Math.floor(index / 3);
  const column = index % 3;
  const x = (column - 1) * 1.25;
  const z = (row - 0.5) * 1.45;

  return (
    <group position={[x, 0.16, z]}>
      <mesh
        castShadow
        position={[0, height / 2, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect({ kind: "building", id: `${community.id}-${index}` });
        }}
      >
        <boxGeometry args={[0.82, height, 0.82]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.08} roughness={0.55} />
      </mesh>
      <mesh position={[0, height + 0.035, 0]}>
        <boxGeometry args={[0.9, 0.07, 0.9]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.12, height * 0.55, 0.416]}>
        <boxGeometry args={[0.12, 0.17, 0.025]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function AgentMarker({ agent, position, color, onSelect }) {
  return (
    <mesh
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect({ kind: "agent", id: agent.id });
      }}
    >
      <sphereGeometry args={[0.11, 12, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
    </mesh>
  );
}

function CommunityDistrict({ community, agents, onSelect }) {
  const [x, z] = COMMUNITY_POSITIONS[community.id] || [0, 0];
  const color = COMMUNITY_COLORS[community.accent] || COMMUNITY_COLORS.violet;

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[5.5, 0.18, 4.2]} />
        <meshStandardMaterial color="#17232b" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[5.38, 0.035, 4.08]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.1} transparent opacity={0.42} />
      </mesh>
      {community.facilities.map((facility, index) => (
        <FacilityBuilding
          key={facility}
          facility={facility}
          index={index}
          community={community}
          onSelect={onSelect}
        />
      ))}
      {agents.map((agent, index) => {
        const angle = (index / Math.max(agents.length, 1)) * Math.PI * 2;
        const position = [
          Math.cos(angle) * 1.92,
          0.24 + (index % 2) * 0.07,
          Math.sin(angle) * 1.62
        ];
        return (
          <AgentMarker
            key={agent.id}
            agent={agent}
            position={position}
            color={color}
            onSelect={onSelect}
          />
        );
      })}
    </group>
  );
}

function CityScene({ world, agents, onSelect, resetToken }) {
  return (
    <>
      <color attach="background" args={["#f4f8f5"]} />
      <fog attach="fog" args={["#f4f8f5", 22, 38]} />
      <ambientLight intensity={1.25} />
      <directionalLight position={[5, 12, 6]} intensity={2.2} color="#ffffff" />
      <pointLight position={[-8, 5, -5]} intensity={20} color="#25834a" distance={15} />
      <pointLight position={[8, 5, 5]} intensity={18} color="#d94f8c" distance={16} />
      <CameraControls resetToken={resetToken} />
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[19.5, 0.36, 13.8]} />
        <meshStandardMaterial color="#edf3ee" roughness={0.92} />
      </mesh>
      <mesh position={[0, -0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[19.3, 13.6]} />
        <meshStandardMaterial color="#f7faf8" roughness={1} />
      </mesh>
      <Road from={COMMUNITY_POSITIONS.greenfield} to={COMMUNITY_POSITIONS.metrocore} />
      <Road from={COMMUNITY_POSITIONS.metrocore} to={COMMUNITY_POSITIONS.novadistrict} />
      <Road from={COMMUNITY_POSITIONS.greenfield} to={COMMUNITY_POSITIONS.novadistrict} />
      {world.communities.map((community) => (
        <CommunityDistrict
          key={community.id}
          community={community}
          agents={agents.filter((agent) => agent.communityId === community.id)}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function City3DView({ world }) {
  const [agents, setAgents] = useState([]);
  const [agentError, setAgentError] = useState("");
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [resetToken, setResetToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/agents")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Agent API returned ${response.status}`);
        if (!cancelled) {
          setAgents(result.agents);
          setAgentError("");
        }
      })
      .catch((error) => {
        if (!cancelled) setAgentError(error.message || "Could not load resident markers.");
      });
    return () => { cancelled = true; };
  }, [world.tick]);

  const selectedDetails = useMemo(() => {
    if (!selectedEntity) return null;
    if (selectedEntity.kind === "agent") {
      const agent = agents.find((item) => item.id === selectedEntity.id);
      return agent ? {
        kind: "agent",
        title: agent.name,
        subtitle: `${agent.roleLabel} · ${world.communities.find((item) =>
          item.id === agent.communityId
        )?.name || "ECHO CITY"}`,
        details: `Energy ${agent.state.energy}% · Wellbeing ${agent.state.wellbeing}% · Tick ${agent.state.tick}`
      } : null;
    }

    const [communityId, facilityIndex] = selectedEntity.id.split("-");
    const community = world.communities.find((item) => item.id === communityId);
    const facility = community?.facilities[Number(facilityIndex)];
    return community && facility ? {
      kind: "building",
      title: facility,
      subtitle: `${community.name} · ${community.type}`,
      details: `${world.population.byCommunity[community.id] || 0} residents · ${community.facilities.length} facilities · ${world.eventSummary.active} active events`
    } : null;
  }, [agents, selectedEntity, world.communities, world.eventSummary.active, world.population.byCommunity]);

  return (
    <section className="panel city3d-panel" aria-label="Interactive city model">
      <div className="panel-heading">
        <div><h3>ECHO CITY · 3D atlas</h3><p>Orbit the districts, select infrastructure, or inspect a resident</p></div>
        <button
          className="panel-action city-reset-button"
          aria-label="Reset city camera"
          title="Reset camera"
          onClick={() => setResetToken((token) => token + 1)}
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <div className="city3d-canvas">
        <Canvas
          camera={{ position: [9, 13, 14], fov: 42 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: false }}
          fallback={<div className="city3d-fallback">WebGL is unavailable in this browser.</div>}
        >
          <CityScene
            world={world}
            agents={agents}
            onSelect={setSelectedEntity}
            resetToken={resetToken}
          />
        </Canvas>
        <div className="city3d-hint"><span className="city3d-live-dot" /> DRAG TO ORBIT <i /> SCROLL TO ZOOM</div>
        <div className="city3d-legend">
          <span><i className="emerald" /> Greenfield</span>
          <span><i className="cyan" /> MetroCore</span>
          <span><i className="violet" /> NovaDistrict</span>
        </div>
      </div>
      <div className="city3d-inspector">
        <span className="city3d-inspector-icon">
          {selectedDetails?.kind === "agent" ? <Users size={15} /> :
            selectedDetails ? <Building2 size={15} /> : <Blocks size={15} />}
        </span>
        <div className="city3d-inspector-copy">
          <strong>{selectedDetails?.title || "Select a building or resident"}</strong>
          <small>{selectedDetails
            ? `${selectedDetails.subtitle} · ${selectedDetails.details}`
            : `${world.communities.length} districts · ${agents.length || world.population.total} residents · Tick ${world.tick}`}</small>
        </div>
        {agentError && <span className="city3d-agent-error" role="status">{agentError}</span>}
      </div>
    </section>
  );
}

export default City3DView;
