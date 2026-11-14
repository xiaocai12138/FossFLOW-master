package com.fossflow.backend.observability.entity;

import java.io.Serializable;
import java.util.Objects;

import com.fossflow.backend.observability.model.EdgeKind;

/** ObsEdge 的复合主键 */
public class ObsEdgeKey implements Serializable {

    private static final long serialVersionUID = 1L;

    private String fromTag;
    private String toTag;
    private EdgeKind kind;
    private String env;

    public ObsEdgeKey() {
        // JPA
    }

    public ObsEdgeKey(String fromTag, String toTag, EdgeKind kind, String env) {
        this.fromTag = fromTag;
        this.toTag = toTag;
        this.kind = kind;
        this.env = env;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }

        if (!(other instanceof ObsEdgeKey key)) {
            return false;
        }

        return Objects.equals(fromTag, key.fromTag)
                && Objects.equals(toTag, key.toTag)
                && kind == key.kind
                && Objects.equals(env, key.env);
    }

    @Override
    public int hashCode() {
        return Objects.hash(fromTag, toTag, kind, env);
    }
}
