/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

/* global browser: true, chrome: true */

export const namespace = typeof browser === 'object' ? browser : chrome;

export const action = namespace?.action || namespace.browserAction;

export const manifestVersion = namespace.runtime.getManifest().manifest_version;

export const extensionId = namespace.runtime.id;

export const extensionUrl = (fname) => namespace.runtime.getURL(fname);
