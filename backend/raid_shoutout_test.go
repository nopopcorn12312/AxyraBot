package main

import "testing"

func TestShouldSendNativeRaidShoutout(t *testing.T) {
	tests := []struct {
		name           string
		raidViewers    int
		minimumViewers int
		want           bool
	}{
		{name: "zero threshold allows any raid", raidViewers: 0, minimumViewers: 0, want: true},
		{name: "raid meets threshold", raidViewers: 12, minimumViewers: 10, want: true},
		{name: "raid below threshold", raidViewers: 9, minimumViewers: 10, want: false},
		{name: "negative threshold is treated as zero", raidViewers: 0, minimumViewers: -1, want: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := shouldSendNativeRaidShoutout(test.raidViewers, test.minimumViewers); got != test.want {
				t.Fatalf("shouldSendNativeRaidShoutout(%d, %d) = %t, want %t", test.raidViewers, test.minimumViewers, got, test.want)
			}
		})
	}
}
