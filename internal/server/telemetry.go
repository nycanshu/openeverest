// Copyright (C) 2026 The OpenEverest Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/openeverest/openeverest/v2/cmd/config"
	"github.com/openeverest/openeverest/v2/pkg/version"
)

const (
	telemetryProductFamily = "PRODUCT_FAMILY_EVEREST"
	telemetryVersionKey    = "version"

	// delay the initial metrics to prevent flooding in case of many restarts.
	initialMetricsDelay = 5 * time.Minute

	numEngineTypes = 3
)

// Telemetry is the struct for telemetry reports.
type Telemetry struct {
	Reports []Report `json:"reports"`
}

// Report is a struct for a single telemetry report.
type Report struct {
	ID            string    `json:"id"`
	CreateTime    time.Time `json:"createTime"`
	InstanceID    string    `json:"instanceId"`
	ProductFamily string    `json:"productFamily"`
	Metrics       []Metric  `json:"metrics"`
}

// Metric represents key-value metrics.
type Metric struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

func (e *EverestServer) report(ctx context.Context, baseURL string, data Telemetry) error {
	b, err := json.Marshal(data)
	if err != nil {
		e.l.Error(errors.Join(err, errors.New("failed to marshal the telemetry report")))
		return err
	}

	url := fmt.Sprintf("%s/v1/telemetry/GenericReport", baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		e.l.Error(errors.Join(err, errors.New("failed to create http request")))
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.l.Error(errors.Join(err, errors.New("failed to send telemetry request")))
		return err
	}
	defer resp.Body.Close() //nolint:errcheck
	if resp.StatusCode != http.StatusOK {
		e.l.Info("Telemetry service responded with http status ", resp.StatusCode)
	}
	return nil
}

// RunTelemetryJob runs background job for collecting telemetry.
func (e *EverestServer) RunTelemetryJob(ctx context.Context, c *config.EverestConfig) {
	e.l.Debug("Starting background jobs runner.")

	interval, err := time.ParseDuration(c.TelemetryInterval)
	if err != nil {
		e.l.Error(errors.Join(err, errors.New("could not parse telemetry interval")))
		return
	}

	timer := time.NewTimer(initialMetricsDelay)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			timer.Reset(interval)
			err = e.collectMetrics(ctx, *c)
			if err != nil {
				e.l.Error(errors.Join(err, errors.New("failed to collect telemetry data")))
			}
		}
	}
}

func (e *EverestServer) collectMetrics(ctx context.Context, config config.EverestConfig) error {
	if config.DisableTelemetry {
		return nil
	}
	everestID, err := e.kubeConnector.GetEverestID(ctx)
	if err != nil {
		e.l.Error(errors.Join(err, errors.New("failed to get Everest settings")))
		return err
	}

	metrics := make([]Metric, 0, numEngineTypes+1)
	// Everest version.
	metrics = append(metrics, Metric{
		Key:   telemetryVersionKey,
		Value: version.Version,
	})

	report := Telemetry{
		[]Report{
			{
				ID:            uuid.NewString(),
				CreateTime:    time.Now(),
				InstanceID:    everestID,
				ProductFamily: telemetryProductFamily,
				Metrics:       metrics,
			},
		},
	}

	return e.report(ctx, config.TelemetryURL, report)
}
