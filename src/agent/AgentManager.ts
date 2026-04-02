import { AgentData, AgentType, AgentStatus, Position } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, SPRITE_SIZE } from '../constants';

const AGENT_SPEED = 0.4;

function generateId(): string {
  return `agent_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function randomTarget(): Position {
  const margin = SPRITE_SIZE * 3;
  return {
    x: margin + Math.floor(Math.random() * (CANVAS_WIDTH - margin * 2)),
    y: margin + Math.floor(Math.random() * (CANVAS_HEIGHT - margin * 2)),
  };
}

export class AgentManager {
  private agents: Map<string, AgentData> = new Map();
  private nextSpriteIndex: number = 0;

  getAll(): readonly AgentData[] {
    return Array.from(this.agents.values());
  }

  getById(id: string): AgentData | undefined {
    return this.agents.get(id);
  }

  addAgent(agentType: AgentType, name: string): AgentData {
    const position = randomTarget();
    const agent: AgentData = {
      id: generateId(),
      name,
      agentType,
      status: 'idle',
      position,
      targetPosition: null,
      terminalId: null,
      createdAt: Date.now(),
      spriteIndex: this.nextSpriteIndex % 5,
      isPlayerControlled: false,
      isSitting: false,
    };
    this.nextSpriteIndex++;
    this.agents.set(agent.id, agent);
    return agent;
  }

  updateStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.set(agentId, { ...agent, status });
    }
  }

  stopAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.set(agentId, { ...agent, targetPosition: null });
    }
  }

  moveAgent(agentId: string, position: Position): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.set(agentId, { ...agent, position, targetPosition: null });
    }
  }

  setTerminalId(agentId: string, terminalId: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.set(agentId, { ...agent, terminalId });
    }
  }

  moveByKey(agentId: string, dx: number, dy: number): void {
    const agent = this.agents.get(agentId);
    if (!agent || agent.isSitting) {
      return;
    }

    const newX = Math.max(16, Math.min(CANVAS_WIDTH - 16, agent.position.x + dx));
    const newY = Math.max(16, Math.min(CANVAS_HEIGHT - 16, agent.position.y + dy));

    this.agents.set(agentId, {
      ...agent,
      position: { x: newX, y: newY },
      targetPosition: null,
      isPlayerControlled: true,
    });
  }

  selectAgent(agentId: string): void {
    for (const [id, agent] of this.agents) {
      this.agents.set(id, { ...agent, isPlayerControlled: id === agentId });
    }
  }

  toggleSit(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return;
    }
    this.agents.set(agentId, { ...agent, isSitting: !agent.isSitting, targetPosition: null });
  }

  removeAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  loadAgents(agents: readonly AgentData[]): void {
    this.agents.clear();
    let maxIdx = -1;
    for (const agent of agents) {
      this.agents.set(agent.id, agent);
      if ((agent.spriteIndex ?? 0) > maxIdx) {
        maxIdx = agent.spriteIndex ?? 0;
      }
    }
    this.nextSpriteIndex = maxIdx + 1;
  }

  tick(): void {
    for (const [id, agent] of this.agents) {
      let updated = agent;

      // Skip random movement for player-controlled or sitting agents
      if (updated.isPlayerControlled || updated.isSitting) {
        this.agents.set(id, updated);
        continue;
      }

      // Pick a new target randomly (more active than creatures)
      if (!updated.targetPosition && Math.random() < 0.02) {
        updated = { ...updated, targetPosition: randomTarget() };
      }

      // Move toward target
      if (updated.targetPosition) {
        const dx = updated.targetPosition.x - updated.position.x;
        const dy = updated.targetPosition.y - updated.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < AGENT_SPEED * 2) {
          updated = { ...updated, position: updated.targetPosition, targetPosition: null };
        } else {
          const nx = dx / dist;
          const ny = dy / dist;
          // Running agents move faster
          const speed = updated.status === 'running' || updated.status === 'generating' ? AGENT_SPEED * 2 : AGENT_SPEED;
          updated = {
            ...updated,
            position: {
              x: updated.position.x + nx * speed,
              y: updated.position.y + ny * speed,
            },
          };
        }
      }

      this.agents.set(id, updated);
    }
  }
}
