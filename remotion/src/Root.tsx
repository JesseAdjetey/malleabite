import { Composition, Folder } from "remotion";
import { MallyAI } from "./compositions/MallyAI";
import { SidebarRules } from "./compositions/SidebarRules";
import { TodoDrag } from "./compositions/TodoDrag";
import { Collaborate } from "./compositions/Collaborate";

const W = 1920;
const H = 1080;
const FPS = 30;

export const RemotionRoot = () => {
  return (
    <Folder name="Malleabite-Marketing">
      <Composition
        id="MallyAI"
        component={MallyAI}
        durationInFrames={19 * FPS}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="SidebarRules"
        component={SidebarRules}
        durationInFrames={22 * FPS}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="TodoDrag"
        component={TodoDrag}
        durationInFrames={16 * FPS}
        fps={FPS}
        width={W}
        height={H}
      />
      <Composition
        id="Collaborate"
        component={Collaborate}
        durationInFrames={20 * FPS}
        fps={FPS}
        width={W}
        height={H}
      />
    </Folder>
  );
};
