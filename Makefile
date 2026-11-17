# make            build build/mwm2.app
# make install    install to ~/Applications and start at login
# make uninstall  stop it and remove the app and login agent
# make dist       zip the signed app for sharing
# make demos      rebuild the README animations in docs/ from docs/scenes (needs bun and svjeez)
# make social     rebuild docs/social-preview.png, the GitHub social preview
#
# Signing: macOS ties the Accessibility grant to the app's signature, so every build must
# be signed by the same certificate or the grant resets. We use the first available of a
# Developer ID Application or Apple Development certificate (override with
# CODESIGN_IDENTITY). Without one we fall back to ad-hoc signing, which works but needs
# Accessibility re-granted after each rebuild.

APP := build/mwm2.app
LABEL := dev.texoport.mwm2
VERSION := $(shell /usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' Info.plist)
INSTALL_DIR ?= $(HOME)/Applications
AGENT := $(HOME)/Library/LaunchAgents/$(LABEL).plist
DOMAIN := gui/$(shell id -u)

CODESIGN_IDENTITY ?= $(shell security find-identity -v -p codesigning | \
	awk '/"Developer ID Application/ && !did { did = $$2 } /"Apple Development/ && !dev { dev = $$2 } END { print (did ? did : dev) }')

SVJEEZ ?= $(HOME)/code/svjeez
SCENES := demo move tile maximize resize cancel displays

.PHONY: app install uninstall dist clean demos social
.DEFAULT_GOAL := app

app:
	swift build -c release
	rm -rf $(APP)
	mkdir -p $(APP)/Contents/MacOS
	cp .build/release/mwm2 $(APP)/Contents/MacOS/mwm2
	cp Info.plist $(APP)/Contents/Info.plist
ifeq ($(CODESIGN_IDENTITY),)
	@echo "warning: no signing certificate found; signing ad-hoc (Accessibility must be re-granted after each rebuild)"
	codesign --force --sign - $(APP)
else
	codesign --force --options runtime --sign $(CODESIGN_IDENTITY) $(APP)
endif
	codesign --verify --strict $(APP)

install: app
	@launchctl bootout $(DOMAIN)/$(LABEL) 2>/dev/null || true
	@pkill -x mwm2 || true
	mkdir -p "$(INSTALL_DIR)" "$(dir $(AGENT))"
	rm -rf "$(INSTALL_DIR)/mwm2.app"
	cp -R $(APP) "$(INSTALL_DIR)/mwm2.app"
	sed 's|@PROGRAM@|$(INSTALL_DIR)/mwm2.app/Contents/MacOS/mwm2|' LaunchAgent.plist > "$(AGENT)"
	launchctl bootstrap $(DOMAIN) "$(AGENT)"
	@echo "Installed $(INSTALL_DIR)/mwm2.app. If it isn't working yet, enable mwm2 in"
	@echo "System Settings > Privacy & Security > Accessibility."

uninstall:
	@launchctl bootout $(DOMAIN)/$(LABEL) 2>/dev/null || true
	@pkill -x mwm2 || true
	rm -f "$(AGENT)"
	rm -rf "$(INSTALL_DIR)/mwm2.app"

dist: app
	mkdir -p dist
	rm -f dist/mwm2-$(VERSION).zip
	ditto -c -k --keepParent $(APP) dist/mwm2-$(VERSION).zip
	@echo "Built dist/mwm2-$(VERSION).zip"

demos:
	mkdir -p docs/scenes/node_modules
	ln -sfn $(SVJEEZ)/packages/svjeez docs/scenes/node_modules/svjeez
	cd docs/scenes && for s in $(SCENES); do \
		bun --conditions=@svjeez/source $(SVJEEZ)/packages/svjeez/src/cli.ts check $$s.tsx || exit 1; \
		bun --conditions=@svjeez/source $(SVJEEZ)/packages/svjeez/src/cli.ts svg $$s.tsx --out ../$$s.svg || exit 1; \
	done

social:
	mkdir -p docs/scenes/node_modules
	ln -sfn $(SVJEEZ)/packages/svjeez docs/scenes/node_modules/svjeez
	cd docs/scenes && bun --conditions=@svjeez/source $(SVJEEZ)/packages/svjeez/src/cli.ts frames social.tsx \
		--times 1.6 --color-scheme dark --out ../../build/social
	cp build/social/*.png docs/social-preview.png

clean:
	rm -rf .build build dist
