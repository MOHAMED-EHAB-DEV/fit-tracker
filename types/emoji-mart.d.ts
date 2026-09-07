declare module "@emoji-mart/data" {
  const data: any;
  export default data;
}

declare module "@emoji-mart/react" {
  import { ComponentType } from "react";
  const Picker: ComponentType<any>;
  export default Picker;
}
