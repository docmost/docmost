import { Heading as HeadingBase } from "@tiptap/extension-heading";

export const Heading = HeadingBase.extend({
	addAttributes() {
		return {
			id: {
				default: null,
				renderHTML: (args) => {
					return {
						'data-level': args.level ?? '1',
					}
				},
			}
		}
	},
})