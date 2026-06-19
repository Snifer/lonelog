import { NotationParser } from '../src/utils/parser';

describe('NotationParser', () => {
	beforeEach(() => {
		NotationParser.clearCache();
	});

	test('parses NPC tags correctly', () => {
		const content = '[N:Jonah|friendly|wounded]';
		const result = NotationParser.parse(content);
		expect(result.npcs.has('Jonah')).toBe(true);
		expect(result.npcs.get('Jonah')?.tags).toEqual(['friendly', 'wounded']);
	});

	test('handles multiple NPC mentions and merges tags', () => {
		const content = `
			[N:Jonah|friendly]
			Some text
			[N:Jonah|wounded]
		`;
		const result = NotationParser.parse(content);
		expect(result.npcs.get('Jonah')?.tags).toContain('friendly');
		expect(result.npcs.get('Jonah')?.tags).toContain('wounded');
		expect(result.npcs.get('Jonah')?.mentions).toHaveLength(2);
	});

	test('preserves existing PC stats when a later mention updates only one field', () => {
		const content = `
			[PC:Primus|HIT 3|GRIT 5|WILL 4]
			=> [PC:Primus|HIT 3|GRIT 5|WILL 4|Fichas Aventura 15]
			[PC:Primus|Fichas Aventura 15]
		`;
		const result = NotationParser.parse(content);
		expect(result.pcs.get('Primus')?.tags).toEqual([
			'HIT 3',
			'GRIT 5',
			'WILL 4',
			'Fichas Aventura 15',
		]);
	});

	test('updates matching PC stat keys without deleting unrelated values', () => {
		const content = `
			[PC:Primus|HIT 3|GRIT 5|WILL 4]
			[PC:Primus|HIT 0]
		`;
		const result = NotationParser.parse(content);
		expect(result.pcs.get('Primus')?.tags).toEqual([
			'HIT 0',
			'GRIT 5',
			'WILL 4',
		]);
	});

	test('parses location tags correctly', () => {
		const content = '[L:Lighthouse|ruined]';
		const result = NotationParser.parse(content);
		expect(result.locations.has('Lighthouse')).toBe(true);
		expect(result.locations.get('Lighthouse')?.tags).toEqual(['ruined']);
	});

	test('parses thread tags and updates state', () => {
		const content = `
			[Thread:Find Sister|Open]
			...
			[Thread:Find Sister|Closed]
		`;
		const result = NotationParser.parse(content);
		expect(result.threads.get('Find Sister')?.state).toBe('Closed');
	});

	test('parses progress elements (clocks, tracks, timers)', () => {
		const content = `
			[E:Alert 2/6]
			[Clock:Ritual 5/12]
			[Track:Investigation 4/10]
			[Timer:Dawn 3]
		`;
		const result = NotationParser.parse(content);

		const clockE = result.progress.find(p => p.type === 'clock' && p.name === 'Alert');
		expect(clockE?.name).toBe('Alert');
		expect(clockE?.current).toBe(2);
		expect(clockE?.max).toBe(6);

		const clockLiteral = result.progress.find(p => p.type === 'clock' && p.name === 'Ritual');
		expect(clockLiteral?.name).toBe('Ritual');
		expect(clockLiteral?.current).toBe(5);
		expect(clockLiteral?.max).toBe(12);

		const track = result.progress.find(p => p.type === 'track');
		expect(track?.name).toBe('Investigation');
		expect(track?.current).toBe(4);
		expect(track?.max).toBe(10);

		const timer = result.progress.find(p => p.type === 'timer');
		expect(timer?.name).toBe('Dawn');
		expect(timer?.current).toBe(3);
	});

	test('inline update syntax uses the -> value as active current', () => {
		const content = `
			[Clock:Ritual 0/6 ->2/6]
			[E:Alert 1/4 ->3/4]
			[Track:Escape 2/8 ->5/8]
			[Timer:Dawn 5 ->3]
		`;
		const result = NotationParser.parse(content);

		const ritual = result.progress.find(p => p.name === 'Ritual');
		expect(ritual?.current).toBe(2);
		expect(ritual?.max).toBe(6);

		const alert = result.progress.find(p => p.name === 'Alert');
		expect(alert?.current).toBe(3);
		expect(alert?.max).toBe(4);

		const escape = result.progress.find(p => p.name === 'Escape');
		expect(escape?.current).toBe(5);
		expect(escape?.max).toBe(8);

		const dawn = result.progress.find(p => p.name === 'Dawn');
		expect(dawn?.current).toBe(3);
	});

	test('tag without -> still parses normally', () => {
		const content = '[Clock:Suspicion 3/6]';
		const result = NotationParser.parse(content);
		const clock = result.progress.find(p => p.name === 'Suspicion');
		expect(clock?.current).toBe(3);
		expect(clock?.max).toBe(6);
	});

	test('parses fractional track progress values', () => {
		const content = `
			[Track:Find Uncle 1.5/10]
			[Track:Bonds 0.25/4]
			[Track:Vow 0.5/10]
		`;
		const result = NotationParser.parse(content);

		const uncle = result.progress.find(p => p.name === 'Find Uncle');
		expect(uncle?.current).toBe(1.5);
		expect(uncle?.max).toBe(10);

		const bonds = result.progress.find(p => p.name === 'Bonds');
		expect(bonds?.current).toBe(0.25);
		expect(bonds?.max).toBe(4);

		const vow = result.progress.find(p => p.name === 'Vow');
		expect(vow?.current).toBe(0.5);
		expect(vow?.max).toBe(10);
	});

	test('fractional track with inline update syntax', () => {
		const content = `
			[Track:Find Uncle 0.5/10 ->1.5/10]
			[Track:Bonds 0/4 ->0.25/4]
		`;
		const result = NotationParser.parse(content);

		const uncle = result.progress.find(p => p.name === 'Find Uncle');
		expect(uncle?.current).toBe(1.5);
		expect(uncle?.max).toBe(10);

		const bonds = result.progress.find(p => p.name === 'Bonds');
		expect(bonds?.current).toBe(0.25);
		expect(bonds?.max).toBe(4);
	});

	test('mixed integer and fractional tracks', () => {
		const content = `
			[Track:Investigation 4/10]
			[Track:Find Uncle 1.5/10]
			[Timer:Dawn 3]
		`;
		const result = NotationParser.parse(content);

		const investigation = result.progress.find(p => p.name === 'Investigation');
		expect(investigation?.current).toBe(4);
		expect(investigation?.max).toBe(10);

		const uncle = result.progress.find(p => p.name === 'Find Uncle');
		expect(uncle?.current).toBe(1.5);
		expect(uncle?.max).toBe(10);

		const dawn = result.progress.find(p => p.name === 'Dawn');
		expect(dawn?.current).toBe(3);
	});

	test('[Inv:Torch|3→2] with unicode arrow updates quantity', () => {
		const content = '[Inv:Torch|3→2]';
		const result = NotationParser.parse(content);
		expect(result.inventory.get('Torch')?.quantity).toBe('2');
	});

	test('[Inv:Torch|3→1] shorthand using unicode arrow', () => {
		const content = `
        [Inv:Torch|3]
        [Inv:Torch|3→1]
    `;
		const result = NotationParser.parse(content);
		expect(result.inventory.get('Torch')?.quantity).toBe('1');
	});

	// ── Slot/Container-based inventory ──────────────────────────────────────────────────
	test('slot container registers without quantity', () => {
		const content = '[Inv:Backpack 1|Torch×6]';
		const result = NotationParser.parse(content);
		const slot = result.inventory.get('Backpack 1');
		expect(slot).toBeDefined();
		expect(slot?.quantity).toBe('');
		expect(slot?.slotParent).toBeUndefined();
	});

	test('slot content registers sub-items with quantity and slotParent', () => {
		const content = '[Inv:Backpack 1|Torch×6]';
		const result = NotationParser.parse(content);
		const torch = result.inventory.get('Torch');
		expect(torch).toBeDefined();
		expect(torch?.quantity).toBe('6');
		expect(torch?.slotParent).toBe('Backpack 1');
	});

	test('delta on slot sub-item resolves correctly', () => {
		const content = `
        [Inv:Backpack 1|Torch×6]
        [Inv:Torch-1]
    `;
		const result = NotationParser.parse(content);
		expect(result.inventory.get('Torch')?.quantity).toBe('5');
	});

	test('multiple slots with multiple sub-items', () => {
		const content = `
        [Inv:Backpack 1|Torch×6]
        [Inv:Backpack 2|Iron Spike×12]
        [Inv:Backpack 3|Iron Rations×7]
        [Inv:Torch-1]
    `;
		const result = NotationParser.parse(content);
		expect(result.inventory.get('Torch')?.quantity).toBe('5');
		expect(result.inventory.get('Iron Spike')?.quantity).toBe('12');
		expect(result.inventory.get('Iron Rations')?.quantity).toBe('7');
		expect(result.inventory.get('Iron Spike')?.slotParent).toBe('Backpack 2');
	});

	test('slot multiplier only accepts ×', () => {
		const content = `
        [Inv:Slot 1|Arrow x 20]
        [Inv:Slot 2|Ration X3]
    `;
		const result = NotationParser.parse(content);
		expect(result.inventory.get('Arrow')).toBeUndefined();
		expect(result.inventory.get('Ration')).toBeUndefined();
	});

	test('plain quantity tag is not treated as slot content', () => {
		const content = '[Inv:Adventuring Kit|1|contains: rope]';
		const result = NotationParser.parse(content);
		const kit = result.inventory.get('Adventuring Kit');
		expect(kit?.quantity).toBe('1');
		expect(kit?.properties).toContain('contains: rope');
		// Must not create a spurious sub-item entry
		expect(result.inventory.has('1')).toBe(false);
	});

	test('[Inv:Slot 1|Short Sword] adds Short Sword with slotParent "Slot 1" and quantity 1', () => {
		const content = '[Inv:Slot 1|Short Sword]';
		const result = NotationParser.parse(content);
		const item = result.inventory.get('Short Sword');
		expect(item).toBeDefined();
		expect(item?.quantity).toBe('1');
		expect(item?.slotParent).toBe('Slot 1');
	});

	test('[Inv:Skeleton Key|unique] — unique is quantity, not an slot item', () => {
		const content = '[Inv:Skeleton Key|unique]';
		const result = NotationParser.parse(content);
		const item = result.inventory.get('Skeleton Key');
		expect(item).toBeDefined();
		expect(item?.quantity).toBe('unique');
		expect(result.inventory.has('unique')).toBe(false);
	});

	test('[Inv:Map to the Ruins] appears in inventory Map', () => {
		const content = '[Inv:Map to the Ruins]';
		const result = NotationParser.parse(content);
		expect(result.inventory.has('Map to the Ruins')).toBe(true);
	});

	test('isSlotName only applies to names like "Word Number"', () => {
		const content = `
        [Inv:Skeleton Key|unique]
        [Inv:Father's Compass|quest]
        [Inv:Slot 1|Short Sword]
    `;
		const result = NotationParser.parse(content);
		// Skeleton Key & Father's Compass: quantity, not slot containers
		expect(result.inventory.get('Skeleton Key')?.quantity).toBe('unique');
		expect(result.inventory.get("Father's Compass")?.quantity).toBe('quest');
		expect(result.inventory.has('unique')).toBe(false);
		expect(result.inventory.has('quest')).toBe(false);
		// Slot 1 is a slot container
		expect(result.inventory.get('Short Sword')?.slotParent).toBe('Slot 1');
	});

	test('isContainer is true for slots, false for normal items', () => {
		const content = `
        [Inv:Slot 1|Short Sword]
        [Inv:Backpack 1|Torch×6]
        [Inv:Map to the Ruins]
        [Inv:Skeleton Key|unique]
    	`;

		const result = NotationParser.parse(content);
		expect(result.inventory.get('Slot 1')?.isContainer).toBe(true);
		expect(result.inventory.get('Backpack 1')?.isContainer).toBe(true);
		expect(result.inventory.get('Short Sword')?.isContainer).toBe(false);
		expect(result.inventory.get('Torch')?.isContainer).toBe(false);
		expect(result.inventory.get('Map to the Ruins')?.isContainer).toBe(false);
		expect(result.inventory.get('Skeleton Key')?.isContainer).toBe(false);
	});

	test('[Inv:Slot 4|empty] is a container without sub-items', () => {
		const content = '[Inv:Slot 4|empty]';
		const result = NotationParser.parse(content);
		const slot = result.inventory.get('Slot 4');
		expect(slot?.isContainer).toBe(true);
		expect(result.inventory.has('empty')).toBe(false);
	});

	// ── Slot/Container item mutation ─────────────────────────────────────────
	test('[Inv:Backpack 1|+Pickaxe] adds Pickaxe to container without prefix', () => {
		const content = `
        [Inv:Backpack 1|Torch×6]
        [Inv:Backpack 1|+Pickaxe]
    `;
		const result = NotationParser.parse(content);
		expect(result.inventory.has('Pickaxe')).toBe(true);
		expect(result.inventory.get('Pickaxe')?.slotParent).toBe('Backpack 1');
		expect(result.inventory.get('Pickaxe')?.quantity).toBe('1');
		expect(result.inventory.has('+Pickaxe')).toBe(false);
	});

	test('[Inv:Backpack 1|-Pickaxe] removes Pickaxe from container', () => {
		const content = `
        [Inv:Backpack 1|Torch×6]
        [Inv:Backpack 1|Pickaxe]
        [Inv:Backpack 1|-Pickaxe]
    `;
		const result = NotationParser.parse(content);
		expect(result.inventory.has('Pickaxe')).toBe(false);
	});

	test('[Inv:Backpack 1|Pickaxe->Shovel] replaces Pickaxe with Shovel in container', () => {
		const content = `
        [Inv:Backpack 1|Pickaxe]
        [Inv:Backpack 1|Pickaxe->Shovel]
    `;
		const result = NotationParser.parse(content);
		expect(result.inventory.has('Shovel')).toBe(true);
		expect(result.inventory.get('Shovel')?.slotParent).toBe('Backpack 1');
		expect(result.inventory.has('Pickaxe')).toBe(false);
	});

	test('[Inv:Backpack 1|Shovel→Lantern] replaces Shovel with Lantern using unicode arrow', () => {
	    const content = `
	        [Inv:Backpack 1|Shovel]
	        [Inv:Backpack 1|Shovel→Lantern]
	    `;
	    const result = NotationParser.parse(content);
	    expect(result.inventory.has('Lantern')).toBe(true);
	    expect(result.inventory.get('Lantern')?.slotParent).toBe('Backpack 1');
	    expect(result.inventory.has('Shovel')).toBe(false);
	});

	test('[Inv:Slot 2|Potion×4|d4] registers Potion with quantity 4 and property d4', () => {
	    const content = '[Inv:Slot 2|Potion×4|d4]';
	    const result = NotationParser.parse(content);
	    const item = result.inventory.get('Potion');
	    expect(item?.quantity).toBe('4');
	    expect(item?.properties).toContain('d4');
	    expect(item?.slotParent).toBe('Slot 2');
	});

	test('[Inv:Slot 2|Potion×4|d4|great|damages undead] registers Potion with all properties', () => {
	    const content = '[Inv:Slot 2|Potion×4|d4|great|damages undead]';
	    const result = NotationParser.parse(content);
	    const item = result.inventory.get('Potion');
	    expect(item?.quantity).toBe('4');
	    expect(item?.properties).toContain('d4');
	    expect(item?.properties).toContain('great');
	    expect(item?.properties).toContain('damages undead');
	    expect(item?.slotParent).toBe('Slot 2');
	});

	test('[Inv:Slot 2|Shield|cracked] registers Shield with property cracked inside Slot 2', () => {
	    const content = '[Inv:Slot 2|Shield|cracked]';
	    const result = NotationParser.parse(content);
	    const item = result.inventory.get('Shield');
	    expect(item).toBeDefined();
	    expect(item?.quantity).toBe('1');
	    expect(item?.slotParent).toBe('Slot 2');
	    expect(item?.properties).toContain('cracked');
	});
});
