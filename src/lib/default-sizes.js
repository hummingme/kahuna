/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

export const defaultAppWindowSize = () => {
    const win = { width: window.innerWidth, height: window.innerHeight };
    const width =
        win.width < 400
            ? `${win.width - 20}px`
            : win.width < 600
              ? `${win.width - 50}px`
              : win.width < 1200
                ? '85vw'
                : win.width < 1600
                  ? '70vw'
                  : '1200px';
    const height =
        win.height < 600
            ? `${win.height - 20}px`
            : win.height < 800
              ? '90vh'
              : win.height < 1100
                ? '85vh'
                : '80vh';
    return { width, height };
};
