/**
 * SPDX-License-Identifier: MPL-2.0
 * SPDX-FileCopyrightText: 2025 Lutz Brückner <dev@kahuna.rocks>
 */

import messenger from './lib/contentscript-messenger.js';
import actor from './lib/contentscript-actor.js';

actor.init(messenger);
messenger.init(actor);
