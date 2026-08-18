import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Switch } from '../src/ui/Switch.tsx';

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

const render = async (props: {
    value: boolean;
    onValueChange: (next: boolean) => void;
    disabled?: boolean;
}) => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
        tree = ReactTestRenderer.create(
            <Switch testID="notifications-switch" {...props} />,
        );
    });

    return tree.root.findByProps({ accessibilityRole: 'switch' });
};

describe('Switch', () => {
    test('reports the opposite value when pressed', async () => {
        const onValueChange = jest.fn();
        const control = await render({ value: false, onValueChange });

        await ReactTestRenderer.act(async () => {
            control.props.onPress();
        });

        expect(onValueChange).toHaveBeenCalledWith(true);
    });

    test('turns off when pressed while on', async () => {
        const onValueChange = jest.fn();
        const control = await render({ value: true, onValueChange });

        await ReactTestRenderer.act(async () => {
            control.props.onPress();
        });

        expect(onValueChange).toHaveBeenCalledWith(false);
    });

    // Screen readers announce this, and it is the only externally visible
    // record of the switch's state now that it is not RN's Switch.
    test('exposes its state to accessibility', async () => {
        const control = await render({ value: true, onValueChange: jest.fn() });

        expect(control.props.accessibilityRole).toBe('switch');
        expect(control.props.accessibilityState).toEqual({
            checked: true,
            disabled: false,
        });
    });

    test('is disabled while busy', async () => {
        const control = await render({
            value: false,
            onValueChange: jest.fn(),
            disabled: true,
        });

        expect(control.props.disabled).toBe(true);
    });
});
